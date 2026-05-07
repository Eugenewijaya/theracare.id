import { db } from "../db/index.js";
import { children, reports, rescheduleRequests, sessionRatings, therapyPrograms, therapySessions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateNITA } from "../utils/id-generators.js";

export const childService = {
  async getAll() {
    return db.query.children.findMany({
      with: { parent: true, therapyPrograms: true },
    });
  },

  async getById(id: string) {
    return db.query.children.findFirst({
      where: eq(children.id, id),
      with: { parent: true, therapyPrograms: true, sessions: true },
    });
  },

  async getByParent(parentId: string) {
    return db.query.children.findMany({
      where: eq(children.parentId, parentId),
      with: { therapyPrograms: true },
    });
  },

  async create(parentId: string, data: {
    firstName: string; lastName: string; dob?: string;
    gender?: string; school?: string; diagnosis?: string;
    therapyProgramsList?: Array<{ type: string; totalSessions: number; goal?: string; icon?: string; colorClass?: string; colorHex?: string; programId?: string }>;
  }) {
    const lastSeq = await this.getLastSequence();
    const nita = generateNITA(lastSeq + 1);

    const [child] = await db.insert(children).values({
      id: nita,
      nita,
      parentId,
      firstName: data.firstName,
      lastName: data.lastName,
      name: `${data.firstName} ${data.lastName}`,
      dob: data.dob,
      gender: data.gender,
      school: data.school,
      diagnosis: data.diagnosis,
    }).returning();

    // Insert therapy programs if provided
    if (data.therapyProgramsList && data.therapyProgramsList.length > 0) {
      await db.insert(therapyPrograms).values(
        data.therapyProgramsList.map((tp) => ({
          childId: nita,
          programId: tp.programId || null,
          type: tp.type,
          totalSessions: tp.totalSessions,
          goal: tp.goal || "",
          icon: tp.icon,
          colorClass: tp.colorClass,
          colorHex: tp.colorHex,
        }))
      );
    }

    return child;
  },

  async update(id: string, updates: Partial<{
    firstName: string; lastName: string; dob: string;
    gender: string; school: string; diagnosis: string; status: string;
  }>) {
    const name = updates.firstName || updates.lastName
      ? `${updates.firstName || ""} ${updates.lastName || ""}`.trim()
      : undefined;

    const [updated] = await db.update(children)
      .set({ ...updates, ...(name ? { name } : {}) })
      .where(eq(children.id, id))
      .returning();
    return updated;
  },

  async delete(id: string) {
    const child = await db.query.children.findFirst({ where: eq(children.id, id) });
    if (!child) return null;

    const session = await db.query.therapySessions.findFirst({ where: eq(therapySessions.childId, id) });
    if (session) return { blocked: true, reason: "Anak masih memiliki sesi terapi." };

    const report = await db.query.reports.findFirst({ where: eq(reports.childId, id) });
    if (report) return { blocked: true, reason: "Anak masih memiliki laporan terapi." };

    const reschedule = await db.query.rescheduleRequests.findFirst({ where: eq(rescheduleRequests.childId, id) });
    if (reschedule) return { blocked: true, reason: "Anak masih memiliki permintaan reschedule." };

    const rating = await db.query.sessionRatings.findFirst({ where: eq(sessionRatings.childId, id) });
    if (rating) return { blocked: true, reason: "Anak masih memiliki rating sesi." };

    await db.delete(therapyPrograms).where(eq(therapyPrograms.childId, id));
    await db.delete(children).where(eq(children.id, id));
    return { deleted: true, id };
  },

  async getLastSequence() {
    const all = await db.select({ nita: children.nita }).from(children);
    if (all.length === 0) return 0;
    const nums = all.map((c) => parseInt(c.nita.slice(-3), 10)).filter(n => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : 0;
  },
};
