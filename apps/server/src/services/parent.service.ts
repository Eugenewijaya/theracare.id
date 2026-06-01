import { db } from "../db/index.js";
import { account, authSession, children, notificationReads, notifications, parents, rescheduleRequests, sessionRatings, user } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { auth } from "../auth.js";
import { randomBytes } from "node:crypto";
import { generateId, generatePortalResetPassword, generateSeqId, generateTempPassword } from "../utils/id-generators.js";
import { setCredentialPassword, verifyCredentialPassword } from "./auth-password.service.js";
import { deviceAccessService } from "./device-access.service.js";
import { assertAllowedStatus, assertValidEmail, assertValidPhone, normalizeEmailAddress, normalizePhoneNumber } from "../utils/registration-validation.js";
import { httpError } from "../utils/http-error.js";

function normalizePhone(phone?: string) {
  return normalizePhoneNumber(phone);
}

function normalizeEmail(email?: string) {
  return normalizeEmailAddress(email);
}

function parentLoginEmail(phone?: string, email?: string) {
  return normalizeEmail(email) || `${normalizePhone(phone)}@parent.theracare.id`;
}

function isGeneratedParentEmail(email?: string) {
  return normalizeEmail(email).endsWith("@parent.theracare.id");
}

function publicParentEmail(email?: string) {
  return isGeneratedParentEmail(email) ? "" : email || "";
}

function formatParent(parent: any) {
  if (!parent) return null;
  return {
    ...parent,
    id: parent.id,
    parentId: parent.id,
    userId: parent.userId,
    name: parent.user?.name || parent.name || "",
    email: publicParentEmail(parent.user?.email || parent.email),
    phone: parent.user?.phone || parent.phone || "",
    status: parent.user?.status || parent.status || "active",
    children: parent.children || [],
  };
}

async function findLoginParent(identifier: string) {
  const raw = (identifier || "").trim();
  const upper = raw.toUpperCase();
  const wantedPhone = normalizePhone(raw);
  const wantedEmail = normalizeEmail(raw);
  if (!raw && !wantedPhone) return null;

  const all = await db.query.parents.findMany({ with: { user: true, children: true } });
  return all.find((p) => {
    if (p.user?.status && p.user.status !== "active") return false;
    const parentIdMatch = (p.id || "").toUpperCase() === upper;
    const phoneMatch = Boolean(wantedPhone) && normalizePhone(p.user?.phone || "") === wantedPhone;
    const emailMatch = Boolean(wantedEmail) && normalizeEmail(p.user?.email) === wantedEmail;
    return parentIdMatch || phoneMatch || emailMatch;
  }) || null;
}

async function createPortalSession(userId: string, clientMeta: { ipAddress?: string; userAgent?: string; deviceId?: string; deviceLabel?: string; deviceScreen?: string; deviceTimezone?: string } = {}) {
  const token = randomBytes(32).toString("hex");
  const sessionId = generateId("SES");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(authSession).values({
    id: sessionId,
    token,
    userId,
    expiresAt,
    ipAddress: clientMeta.ipAddress || null,
    userAgent: clientMeta.userAgent || null,
  });
  await deviceAccessService.assertSessionAllowed({ userId, userRole: "parent", sessionId, sessionToken: token }, clientMeta);
  return token;
}

async function archiveUser(userId: string, reason: string) {
  await db.update(user)
    .set({
      status: "deleted",
      banned: true,
      banReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
  await db.delete(authSession).where(eq(authSession.userId, userId));
}

async function deleteAuthUser(userId: string) {
  await db.delete(notificationReads).where(eq(notificationReads.userId, userId));
  await db.delete(notifications).where(eq(notifications.targetUserId, userId));
  await db.delete(authSession).where(eq(authSession.userId, userId));
  await db.delete(account).where(eq(account.userId, userId));
  await db.delete(user).where(eq(user.id, userId));
}

async function assertParentLoginAvailable(input: { email?: string; phone?: string; excludeUserId?: string }) {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (email) {
    const existing = await db.query.user.findFirst({ where: eq(user.email, email) });
    if (existing && existing.id !== input.excludeUserId) {
      throw httpError(409, "Email sudah digunakan oleh akun lain.");
    }
  }
  if (phone) {
    const rows = await db.query.parents.findMany({ with: { user: true } });
    const duplicate = rows.find((row) => (
      row.userId !== input.excludeUserId
      && row.user?.status !== "deleted"
      && normalizePhone(row.user?.phone || "") === phone
    ));
    if (duplicate) throw httpError(409, "Nomor HP sudah digunakan oleh akun orang tua lain.");
  }
}

async function getLastParentSequence(client: typeof db | any = db) {
  const all = await client.select({ id: parents.id }).from(parents);
  if (all.length === 0) return 0;
  const nums = all.map((p: any) => parseInt(String(p.id || "").replace("P-", ""), 10)).filter((n: number) => !Number.isNaN(n));
  return nums.length > 0 ? Math.max(...nums) : 0;
}

export const parentService = {
  async getAll() {
    const rows = await db.query.parents.findMany({
      with: { user: true, children: true },
    });
    return rows.filter((row) => row.user?.status !== "deleted").map(formatParent);
  },

  async getById(id: string) {
    const parent = await db.query.parents.findFirst({
      where: eq(parents.id, id),
      with: { user: true, children: true },
    });
    return formatParent(parent);
  },

  async getByUserId(userId: string) {
    const parent = await db.query.parents.findFirst({
      where: eq(parents.userId, userId),
      with: { user: true, children: true },
    });
    return formatParent(parent);
  },

  async getLoginIdentity(identifier: string) {
    const raw = (identifier || "").trim();
    const parent = await findLoginParent(identifier);
    if (!parent || parent.user?.status !== "active") return null;
    return {
      loginId: raw,
      accountType: "parent",
      identifierMatched: true,
    };
  },

  async portalLogin(identifier: string, password: string, clientMeta: { ipAddress?: string; userAgent?: string; deviceId?: string; deviceLabel?: string; deviceScreen?: string; deviceTimezone?: string } = {}) {
    const parent = await findLoginParent(identifier);
    if (!parent || parent.user?.status !== "active") return null;
    const isValid = await verifyCredentialPassword(parent.userId, password);
    if (!isValid) return null;
    const token = await createPortalSession(parent.userId, clientMeta);
    return { token, parent: formatParent(parent) };
  },

  async create(data: { name: string; email?: string; phone?: string; address?: string; tempPassword?: string }, _lastId?: number) {
    const name = String(data.name || "").trim();
    if (!name) throw httpError(400, "Nama orang tua wajib diisi.");
    const phone = assertValidPhone(data.phone || "", "Nomor HP orang tua", !data.email);
    const explicitEmail = assertValidEmail(data.email || "", "Email orang tua", !phone);
    const tempPassword = data.tempPassword?.trim() || generateTempPassword();
    const email = parentLoginEmail(phone, explicitEmail);
    await assertParentLoginAvailable({ email, phone });

    const newUser = await auth.api.createUser({
      body: {
        email,
        password: tempPassword,
        name,
        role: "parent" as any,
        phone,
      } as any,
    });

    try {
      await db.update(user)
        .set({ phone, role: "parent", status: "active", updatedAt: new Date() })
        .where(eq(user.id, newUser.user.id));
      const [createdUser] = await db.select().from(user).where(eq(user.id, newUser.user.id));

      const parent = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('registration:parent-sequence'))`);
        const parentId = generateSeqId("P", await getLastParentSequence(tx) + 1);
        const [createdParent] = await tx.insert(parents).values({
          id: parentId,
          userId: newUser.user.id,
          address: String(data.address || "").trim(),
        }).returning();
        return createdParent;
      });

      return { ...formatParent({ ...parent, user: createdUser, children: [] }), parent, tempPassword, user: createdUser };
    } catch (error) {
      await deleteAuthUser(newUser.user.id);
      throw error;
    }
  },

  async updateStatus(id: string, status: string) {
    const parent = await db.query.parents.findFirst({ where: eq(parents.id, id) });
    if (!parent) return null;
    const nextStatus = assertAllowedStatus(status, ["active", "suspended"], "Status orang tua");
    await db.update(user).set({ status: nextStatus, updatedAt: new Date() }).where(eq(user.id, parent.userId));
    return { id, status: nextStatus };
  },

  async update(id: string, updates: { name?: string; email?: string; phone?: string; address?: string; status?: string }) {
    const parent = await db.query.parents.findFirst({ where: eq(parents.id, id), with: { user: true } });
    if (!parent) return null;

    const userUpdates: any = {};
    if (typeof updates.name === "string") {
      const name = updates.name.trim();
      if (!name) throw httpError(400, "Nama orang tua wajib diisi.");
      userUpdates.name = name;
    }
    if (typeof updates.phone === "string") userUpdates.phone = assertValidPhone(updates.phone, "Nomor HP orang tua", false);
    if (typeof updates.status === "string") userUpdates.status = assertAllowedStatus(updates.status, ["active", "suspended"], "Status orang tua");
    if (typeof updates.email === "string") {
      const nextEmail = assertValidEmail(updates.email, "Email orang tua", false);
      if (nextEmail) {
        userUpdates.email = nextEmail;
      } else if (typeof updates.phone === "string" || isGeneratedParentEmail(parent.user?.email)) {
        const nextPhone = userUpdates.phone ?? parent.user?.phone ?? "";
        if (normalizePhone(nextPhone)) userUpdates.email = parentLoginEmail(nextPhone);
      }
    } else if (typeof updates.phone === "string" && isGeneratedParentEmail(parent.user?.email)) {
      if (normalizePhone(updates.phone)) userUpdates.email = parentLoginEmail(updates.phone);
    }
    const nextPhone = typeof userUpdates.phone === "string" ? userUpdates.phone : parent.user?.phone || "";
    const nextEmail = typeof userUpdates.email === "string" ? userUpdates.email : parent.user?.email || "";
    if (!normalizePhone(nextPhone) && !normalizeEmail(nextEmail)) {
      throw httpError(400, "Isi nomor HP atau email agar akun orang tua tetap bisa login.");
    }
    await assertParentLoginAvailable({ email: nextEmail, phone: nextPhone, excludeUserId: parent.userId });
    if (Object.keys(userUpdates).length > 0) {
      await db.update(user).set({ ...userUpdates, updatedAt: new Date() }).where(eq(user.id, parent.userId));
    }

    if (typeof updates.address === "string") {
      await db.update(parents).set({ address: updates.address }).where(eq(parents.id, id));
    }

    return this.getById(id);
  },

  async resetPassword(id: string, passwordOverride?: string) {
    const parent = await db.query.parents.findFirst({ where: eq(parents.id, id) });
    if (!parent) return null;
    const tempPassword = passwordOverride?.trim() || generatePortalResetPassword();
    await setCredentialPassword(parent.userId, tempPassword);
    return { id, tempPassword };
  },

  async delete(id: string) {
    const parent = await db.query.parents.findFirst({ where: eq(parents.id, id) });
    if (!parent) return null;

    const child = await db.query.children.findFirst({ where: eq(children.parentId, id) });
    if (child) {
      await archiveUser(parent.userId, "Parent account archived by admin while child records still exist.");
      return { deleted: true, archived: true, id, reason: "Akun orang tua diarsipkan karena masih memiliki data anak." };
    }

    const reschedule = await db.query.rescheduleRequests.findFirst({ where: eq(rescheduleRequests.parentId, id) });
    if (reschedule) {
      await archiveUser(parent.userId, "Parent account archived by admin while reschedule requests still exist.");
      return { deleted: true, archived: true, id, reason: "Akun orang tua diarsipkan karena masih memiliki permintaan reschedule." };
    }

    const rating = await db.query.sessionRatings.findFirst({ where: eq(sessionRatings.parentId, id) });
    if (rating) {
      await archiveUser(parent.userId, "Parent account archived by admin while session ratings still exist.");
      return { deleted: true, archived: true, id, reason: "Akun orang tua diarsipkan karena masih memiliki rating sesi." };
    }

    await db.delete(parents).where(eq(parents.id, id));
    await deleteAuthUser(parent.userId);
    return { deleted: true, id };
  },

  async getLastId() {
    return getLastParentSequence();
  },
};
