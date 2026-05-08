import { db } from "../db/index.js";
import { account, authSession, children, notificationReads, parents, rescheduleRequests, sessionRatings, user } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { auth } from "../auth.js";
import { generateTempPassword, generateSeqId } from "../utils/id-generators.js";

function normalizePhone(phone?: string) {
  return (phone || "").replace(/\D/g, "");
}

function parentLoginEmail(phone?: string, email?: string) {
  return email?.trim() || `${normalizePhone(phone)}@parent.theracare.id`;
}

function formatParent(parent: any) {
  if (!parent) return null;
  return {
    ...parent,
    id: parent.id,
    parentId: parent.id,
    userId: parent.userId,
    name: parent.user?.name || parent.name || "",
    email: parent.user?.email || parent.email || "",
    phone: parent.user?.phone || parent.phone || "",
    status: parent.user?.status || parent.status || "active",
    children: parent.children || [],
  };
}

export const parentService = {
  async getAll() {
    const rows = await db.query.parents.findMany({
      with: { user: true, children: true },
    });
    return rows.map(formatParent);
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

  async getLoginIdentity(phone: string) {
    const wanted = normalizePhone(phone);
    if (!wanted) return null;
    const all = await db.query.parents.findMany({ with: { user: true, children: true } });
    const parent = all.find((p) => normalizePhone(p.user?.phone || "") === wanted);
    if (!parent || parent.user?.status === "suspended") return null;
    return {
      parentId: parent.id,
      email: parent.user?.email,
      name: parent.user?.name,
      phone: parent.user?.phone,
      children: parent.children || [],
    };
  },

  async create(data: { name: string; email?: string; phone?: string; address?: string }, lastId: number) {
    const tempPassword = generateTempPassword();
    const parentId = generateSeqId("P", lastId + 1);
    const email = parentLoginEmail(data.phone, data.email);
    const phone = data.phone?.trim() || "";

    // Create Better Auth user
    const newUser = await auth.api.createUser({
      body: {
        email,
        password: tempPassword,
        name: data.name,
        role: "parent" as any,
        phone,
      } as any,
    });

    await db.update(user)
      .set({ phone, role: "parent", status: "active", updatedAt: new Date() })
      .where(eq(user.id, newUser.user.id));
    const [createdUser] = await db.select().from(user).where(eq(user.id, newUser.user.id));

    // Create parent record
    const [parent] = await db.insert(parents).values({
      id: parentId,
      userId: newUser.user.id,
      address: data.address || "",
    }).returning();

    return { ...formatParent({ ...parent, user: createdUser, children: [] }), parent, tempPassword, user: createdUser };
  },

  async updateStatus(id: string, status: string) {
    const parent = await db.query.parents.findFirst({ where: eq(parents.id, id) });
    if (!parent) return null;
    await db.update(user).set({ status, updatedAt: new Date() }).where(eq(user.id, parent.userId));
    return { id, status };
  },

  async update(id: string, updates: { name?: string; email?: string; phone?: string; address?: string; status?: string }) {
    const parent = await db.query.parents.findFirst({ where: eq(parents.id, id) });
    if (!parent) return null;

    const userUpdates: any = {};
    if (typeof updates.name === "string") userUpdates.name = updates.name.trim();
    if (typeof updates.email === "string" && updates.email.trim()) userUpdates.email = updates.email.trim();
    if (typeof updates.phone === "string") userUpdates.phone = updates.phone.trim();
    if (typeof updates.status === "string") userUpdates.status = updates.status;
    if (Object.keys(userUpdates).length > 0) {
      await db.update(user).set({ ...userUpdates, updatedAt: new Date() }).where(eq(user.id, parent.userId));
    }

    if (typeof updates.address === "string") {
      await db.update(parents).set({ address: updates.address }).where(eq(parents.id, id));
    }

    return this.getById(id);
  },

  async resetPassword(id: string) {
    const parent = await db.query.parents.findFirst({ where: eq(parents.id, id) });
    if (!parent) return null;
    const tempPassword = generateTempPassword();
    await auth.api.setPassword({ body: { userId: parent.userId, newPassword: tempPassword } } as any);
    return { id, tempPassword };
  },

  async delete(id: string) {
    const parent = await db.query.parents.findFirst({ where: eq(parents.id, id) });
    if (!parent) return null;

    const child = await db.query.children.findFirst({ where: eq(children.parentId, id) });
    if (child) {
      return { blocked: true, reason: "Orang tua masih memiliki data anak. Hapus atau pindahkan data anak terlebih dahulu." };
    }

    const reschedule = await db.query.rescheduleRequests.findFirst({ where: eq(rescheduleRequests.parentId, id) });
    if (reschedule) {
      return { blocked: true, reason: "Orang tua masih memiliki permintaan reschedule." };
    }

    const rating = await db.query.sessionRatings.findFirst({ where: eq(sessionRatings.parentId, id) });
    if (rating) {
      return { blocked: true, reason: "Orang tua masih memiliki rating sesi." };
    }

    await db.delete(parents).where(eq(parents.id, id));
    await db.delete(notificationReads).where(eq(notificationReads.userId, parent.userId));
    await db.delete(authSession).where(eq(authSession.userId, parent.userId));
    await db.delete(account).where(eq(account.userId, parent.userId));
    await db.delete(user).where(eq(user.id, parent.userId));
    return { deleted: true, id };
  },

  async getLastId() {
    const all = await db.select({ id: parents.id }).from(parents);
    if (all.length === 0) return 0;
    const nums = all.map((p) => parseInt(p.id.replace("P-", ""), 10)).filter(n => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : 0;
  },
};
