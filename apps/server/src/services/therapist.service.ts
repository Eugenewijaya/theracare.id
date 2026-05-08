import { db } from "../db/index.js";
import { account, authSession, notificationReads, reports, therapists, therapySessions, user } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { auth } from "../auth.js";
import { generateTempPassword, generateNIT } from "../utils/id-generators.js";

function formatTherapist(therapist: any) {
  if (!therapist) return null;
  return {
    ...therapist,
    id: therapist.id,
    nit: therapist.nit,
    userId: therapist.userId,
    name: therapist.user?.name || therapist.name || "",
    email: therapist.user?.email || therapist.email || "",
    phone: therapist.user?.phone || therapist.phone || "",
    status: therapist.user?.status || therapist.status || "active",
    specialization: therapist.specialty || therapist.specialization || "Therapist",
  };
}

export const therapistService = {
  async getAll() {
    const rows = await db.query.therapists.findMany({ with: { user: true } });
    return rows.map(formatTherapist);
  },

  async getById(id: string) {
    const therapist = await db.query.therapists.findFirst({
      where: eq(therapists.id, id),
      with: { user: true, sessions: true },
    });
    return formatTherapist(therapist);
  },

  async getByUserId(userId: string) {
    const therapist = await db.query.therapists.findFirst({
      where: eq(therapists.userId, userId),
      with: { user: true },
    });
    return formatTherapist(therapist);
  },

  async getLoginIdentity(nit: string) {
    const id = nit.trim().toUpperCase();
    if (!id) return null;
    const therapist = await db.query.therapists.findFirst({
      where: eq(therapists.nit, id),
      with: { user: true },
    });
    if (!therapist || therapist.user?.status === "suspended") return null;
    return {
      therapistId: therapist.id,
      nit: therapist.nit,
      email: therapist.user?.email,
      name: therapist.user?.name,
      specialty: therapist.specialty,
    };
  },

  async create(data: { name: string; email: string; phone?: string; specialty?: string; tempPassword?: string }) {
    const tempPassword = data.tempPassword?.trim() || generateTempPassword();
    const lastSeq = await this.getLastSequence();
    const nit = generateNIT(data.name, lastSeq + 1);
    const phone = data.phone?.trim() || "";

    const newUser = await auth.api.createUser({
      body: {
        email: data.email,
        password: tempPassword,
        name: data.name,
        role: "therapist" as any,
        phone,
      } as any,
    });

    await db.update(user)
      .set({ phone, role: "therapist", status: "active", updatedAt: new Date() })
      .where(eq(user.id, newUser.user.id));
    const [createdUser] = await db.select().from(user).where(eq(user.id, newUser.user.id));

    const [therapist] = await db.insert(therapists).values({
      id: nit,
      userId: newUser.user.id,
      nit,
      specialty: data.specialty || "Therapist",
    }).returning();

    return { ...formatTherapist({ ...therapist, user: createdUser }), therapist, tempPassword, user: createdUser };
  },

  async updateProfile(id: string, updates: { name?: string; email?: string; phone?: string; specialty?: string; specialization?: string; status?: string }) {
    const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, id) });
    if (!therapist) return null;

    const specialty = updates.specialty || updates.specialization;
    if (specialty) {
      await db.update(therapists).set({ specialty }).where(eq(therapists.id, id));
    }

    const userUpdates: any = {};
    if (typeof updates.name === "string") userUpdates.name = updates.name.trim();
    if (typeof updates.email === "string" && updates.email.trim()) userUpdates.email = updates.email.trim();
    if (typeof updates.phone === "string") userUpdates.phone = updates.phone.trim();
    if (typeof updates.status === "string") userUpdates.status = updates.status;
    if (Object.keys(userUpdates).length > 0) {
      await db.update(user).set({ ...userUpdates, updatedAt: new Date() }).where(eq(user.id, therapist.userId));
    }
    return this.getById(id);
  },

  async updateStatus(id: string, status: string) {
    const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, id) });
    if (!therapist) return null;
    await db.update(user).set({ status, updatedAt: new Date() }).where(eq(user.id, therapist.userId));
    return { id, status };
  },

  async resetPassword(id: string) {
    const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, id) });
    if (!therapist) return null;
    const tempPassword = generateTempPassword();
    await auth.api.setPassword({ body: { userId: therapist.userId, newPassword: tempPassword } } as any);
    return { id, tempPassword };
  },

  async delete(id: string) {
    const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, id) });
    if (!therapist) return null;

    const session = await db.query.therapySessions.findFirst({ where: eq(therapySessions.therapistId, id) });
    if (session) {
      return { blocked: true, reason: "Terapis masih memiliki sesi terapi." };
    }

    const report = await db.query.reports.findFirst({ where: eq(reports.therapistId, id) });
    if (report) {
      return { blocked: true, reason: "Terapis masih memiliki laporan terapi." };
    }

    await db.delete(therapists).where(eq(therapists.id, id));
    await db.delete(notificationReads).where(eq(notificationReads.userId, therapist.userId));
    await db.delete(authSession).where(eq(authSession.userId, therapist.userId));
    await db.delete(account).where(eq(account.userId, therapist.userId));
    await db.delete(user).where(eq(user.id, therapist.userId));
    return { deleted: true, id };
  },

  async getLastSequence() {
    const all = await db.select({ nit: therapists.nit }).from(therapists);
    if (all.length === 0) return 0;
    const nums = all.map((t) => parseInt(t.nit.slice(-3), 10)).filter(n => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : 0;
  },
};
