import { db } from "../db/index.js";
import { therapists, user } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { auth } from "../auth.js";
import { generateTempPassword, generateNIT } from "../utils/id-generators.js";

export const therapistService = {
  async getAll() {
    return db.query.therapists.findMany({ with: { user: true } });
  },

  async getById(id: string) {
    return db.query.therapists.findFirst({
      where: eq(therapists.id, id),
      with: { user: true, sessions: true },
    });
  },

  async getByUserId(userId: string) {
    return db.query.therapists.findFirst({
      where: eq(therapists.userId, userId),
      with: { user: true },
    });
  },

  async create(data: { name: string; email: string; phone?: string; specialty?: string }) {
    const tempPassword = generateTempPassword();
    const lastSeq = await this.getLastSequence();
    const nit = generateNIT(data.name, lastSeq + 1);

    const newUser = await auth.api.createUser({
      body: {
        email: data.email,
        password: tempPassword,
        name: data.name,
        role: "therapist" as any,
        phone: data.phone || "",
      } as any,
    });

    const [therapist] = await db.insert(therapists).values({
      id: nit,
      userId: newUser.user.id,
      nit,
      specialty: data.specialty || "Therapist",
    }).returning();

    return { therapist, tempPassword, user: newUser.user };
  },

  async updateProfile(id: string, updates: { name?: string; phone?: string; specialty?: string }) {
    const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, id) });
    if (!therapist) return null;

    if (updates.specialty) {
      await db.update(therapists).set({ specialty: updates.specialty }).where(eq(therapists.id, id));
    }
    if (updates.name || updates.phone) {
      await db.update(user).set({
        ...(updates.name ? { name: updates.name } : {}),
        ...(updates.phone ? { phone: updates.phone } : {}),
        updatedAt: new Date(),
      }).where(eq(user.id, therapist.userId));
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

  async getLastSequence() {
    const all = await db.select({ nit: therapists.nit }).from(therapists);
    if (all.length === 0) return 0;
    const nums = all.map((t) => parseInt(t.nit.slice(-3), 10)).filter(n => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : 0;
  },
};
