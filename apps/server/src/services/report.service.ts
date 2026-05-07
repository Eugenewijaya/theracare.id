import { db } from "../db/index.js";
import { children, parents, reports, therapySessions } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { generateSeqId } from "../utils/id-generators.js";
import { notificationService } from "./notification.service.js";

export const reportService = {
  async getForTherapist(therapistId: string, type?: string) {
    const conditions = [eq(reports.therapistId, therapistId)];
    if (type) conditions.push(eq(reports.type, type));
    return db.query.reports.findMany({
      where: and(...conditions),
      with: { child: true, session: true },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
  },

  async getForChild(childId: string, type?: string) {
    const conditions = [eq(reports.childId, childId)];
    if (type) conditions.push(eq(reports.type, type));
    return db.query.reports.findMany({
      where: and(...conditions),
      with: { therapist: { with: { user: true } }, session: true },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
  },

  async getSessionReport(sessionId: string) {
    return db.query.reports.findFirst({
      where: and(eq(reports.type, "harian"), eq(reports.sessionId, sessionId)),
    });
  },

  async save(data: any) {
    const now = new Date();

    // Check if updating existing report
    if (data.id) {
      const [updated] = await db.update(reports)
        .set({ ...data, updatedAt: now })
        .where(eq(reports.id, data.id))
        .returning();
      return updated;
    }

    // Check for existing daily report for same session
    if (data.type === "harian" && data.sessionId) {
      const existing = await db.query.reports.findFirst({
        where: and(eq(reports.type, "harian"), eq(reports.sessionId, data.sessionId)),
      });
      if (existing) {
        const [updated] = await db.update(reports)
          .set({ ...data, updatedAt: now })
          .where(eq(reports.id, existing.id))
          .returning();
        return updated;
      }
    }

    // Create new report
    const lastId = await this.getLastId();
    const id = generateSeqId("REP", lastId + 1);
    const [report] = await db.insert(reports).values({
      ...data, id, status: "pending_review", createdAt: now, updatedAt: now,
    }).returning();

    // Update session notes if daily report
    if (data.type === "harian" && data.sessionId && data.description) {
      await db.update(therapySessions)
        .set({ notes: data.description })
        .where(eq(therapySessions.id, data.sessionId));
    }

    return report;
  },

  async updateStatus(id: string, status: string) {
    const [updated] = await db.update(reports)
      .set({ status, updatedAt: new Date() })
      .where(eq(reports.id, id))
      .returning();
    if (updated && ["approved", "published", "ready_for_parent"].includes(status)) {
      const child = await db.query.children.findFirst({ where: eq(children.id, updated.childId) });
      const parent = child ? await db.query.parents.findFirst({ where: eq(parents.id, child.parentId) }) : null;
      if (parent?.userId) {
        await notificationService.create({
          type: "report_published",
          icon: "description",
          title: "Laporan terapi tersedia",
          message: "Laporan perkembangan anak sudah dapat dilihat di portal orang tua.",
          targetRole: "parent",
          targetUserId: parent.userId,
          relatedId: id,
        });
      }
    }
    return updated;
  },

  async getLastId() {
    const all = await db.select({ id: reports.id }).from(reports);
    if (all.length === 0) return 0;
    const nums = all.map((r) => parseInt(r.id.replace("REP-", ""), 10)).filter(n => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : 0;
  },
};
