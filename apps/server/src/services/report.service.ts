import { db } from "../db/index.js";
import { children, parents, reports, therapySessions } from "../db/schema.js";
import { eq, and, inArray, sql } from "drizzle-orm";
import { generateSeqId } from "../utils/id-generators.js";
import { notificationService } from "./notification.service.js";

type ReportInsert = typeof reports.$inferInsert;
type ReportQueryOptions = { visibleToParentOnly?: boolean; therapistId?: string };
type ReportUpdateOptions = { allowStatus?: boolean };

const PARENT_VISIBLE_REPORT_STATUSES = ["approved", "published", "ready_for_parent"];

function formatReport(report: any) {
  if (!report) return null;
  return {
    ...report,
    childName: report.child?.name || report.childName || "",
    therapistName: report.therapist?.user?.name || report.therapistName || "",
  };
}

function pickReportValues(data: any, options: ReportUpdateOptions = { allowStatus: true }): Partial<ReportInsert> {
  return {
    ...(typeof data.type === "string" ? { type: data.type } : {}),
    ...(typeof data.childId === "string" ? { childId: data.childId } : {}),
    ...(typeof data.therapistId === "string" ? { therapistId: data.therapistId } : {}),
    ...(typeof data.sessionId === "string" && data.sessionId ? { sessionId: data.sessionId } : {}),
    ...(options.allowStatus !== false && typeof data.status === "string" ? { status: data.status } : {}),
    ...(typeof data.date === "string" ? { date: data.date } : {}),
    ...(typeof data.sessionFocus === "string" ? { sessionFocus: data.sessionFocus } : {}),
    ...(Array.isArray(data.aspects) ? { aspects: data.aspects } : {}),
    ...(data.evaluations && typeof data.evaluations === "object" ? { evaluations: data.evaluations } : {}),
    ...(Number.isFinite(Number(data.sessionScore)) ? { sessionScore: Number(data.sessionScore) } : {}),
    ...(typeof data.description === "string" ? { description: data.description } : {}),
    ...(typeof data.childResponse === "string" ? { childResponse: data.childResponse } : {}),
    ...(typeof data.obstacles === "string" ? { obstacles: data.obstacles } : {}),
    ...(typeof data.recommendations === "string" ? { recommendations: data.recommendations } : {}),
    ...(typeof data.internalNotes === "string" ? { internalNotes: data.internalNotes } : {}),
    ...(typeof data.dateFrom === "string" ? { dateFrom: data.dateFrom } : {}),
    ...(typeof data.dateTo === "string" ? { dateTo: data.dateTo } : {}),
    ...(Array.isArray(data.progressPoints) ? { progressPoints: data.progressPoints } : {}),
    ...(Array.isArray(data.improvementPoints) ? { improvementPoints: data.improvementPoints } : {}),
    ...(typeof data.summary === "string" ? { summary: data.summary } : {}),
    ...(typeof data.parentNotes === "string" ? { parentNotes: data.parentNotes } : {}),
  };
}

export const reportService = {
  async canParentAccessChild(userId: string, childId: string) {
    const parent = await db.query.parents.findFirst({ where: eq(parents.userId, userId) });
    if (!parent) return false;
    const child = await db.query.children.findFirst({
      where: and(eq(children.id, childId), eq(children.parentId, parent.id)),
    });
    return !!child;
  },

  async getById(id: string) {
    const report = await db.query.reports.findFirst({
      where: eq(reports.id, id),
      with: { child: true, therapist: { with: { user: true } }, session: true },
    });
    return formatReport(report);
  },

  async getForTherapist(therapistId: string, type?: string) {
    const conditions = [eq(reports.therapistId, therapistId)];
    if (type) conditions.push(eq(reports.type, type));
    const rows = await db.query.reports.findMany({
      where: and(...conditions),
      with: { child: true, session: true },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
    return rows.map(formatReport);
  },

  async getForChild(childId: string, type?: string, options: ReportQueryOptions = {}) {
    const conditions = [eq(reports.childId, childId)];
    if (type) conditions.push(eq(reports.type, type));
    if (options.visibleToParentOnly) {
      conditions.push(inArray(reports.status, PARENT_VISIBLE_REPORT_STATUSES));
    }
    if (options.therapistId) {
      conditions.push(eq(reports.therapistId, options.therapistId));
    }
    const rows = await db.query.reports.findMany({
      where: and(...conditions),
      with: { therapist: { with: { user: true } }, session: true },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
    return rows.map(formatReport);
  },

  async getAll(status?: string) {
    const conditions: any[] = [];
    if (status) conditions.push(eq(reports.status, status));
    const rows = await db.query.reports.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      with: { child: true, therapist: { with: { user: true } }, session: true },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
    return rows.map(formatReport);
  },

  async getSessionReport(sessionId: string) {
    const report = await db.query.reports.findFirst({
      where: and(eq(reports.type, "harian"), eq(reports.sessionId, sessionId)),
      with: { child: true, therapist: { with: { user: true } }, session: true },
    });
    return formatReport(report);
  },

  async save(data: any) {
    const now = new Date();

    // Check if updating existing report
    if (data.id) {
      const [updated] = await db.update(reports)
        .set({ ...pickReportValues(data, { allowStatus: false }), status: "pending_review", updatedAt: now })
        .where(eq(reports.id, data.id))
        .returning();
      return formatReport(updated);
    }

    // Check for existing daily report for same session
    if (data.type === "harian" && data.sessionId) {
      const existing = await db.query.reports.findFirst({
        where: and(eq(reports.type, "harian"), eq(reports.sessionId, data.sessionId)),
      });
      if (existing) {
        const [updated] = await db.update(reports)
          .set({ ...pickReportValues(data, { allowStatus: false }), status: "pending_review", updatedAt: now })
          .where(eq(reports.id, existing.id))
          .returning();
        return formatReport(updated);
      }
    }

    // Create new report
    const lastId = await this.getLastId();
    const id = generateSeqId("REP", lastId + 1);
    const values: ReportInsert = {
      id,
      type: data.type,
      childId: data.childId,
      therapistId: data.therapistId,
      ...pickReportValues(data),
      status: "pending_review",
      createdAt: now,
      updatedAt: now,
    };
    const [report] = await db.insert(reports).values(values).returning();

    // Update session notes if daily report
    if (data.type === "harian" && data.sessionId && data.description) {
      await db.update(therapySessions)
        .set({ notes: data.description })
        .where(eq(therapySessions.id, data.sessionId));
    }

    return formatReport(report);
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

  async update(id: string, updates: any, options: ReportUpdateOptions = {}) {
    const values: any = pickReportValues(updates, options);
    if (Object.keys(values).length === 0) return this.getById(id);

    const [updated] = await db.update(reports)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(reports.id, id))
      .returning();
    return formatReport(updated);
  },

  async delete(id: string) {
    const report = await db.query.reports.findFirst({ where: eq(reports.id, id) });
    if (!report) return null;
    await db.delete(reports).where(eq(reports.id, id));
    return { deleted: true, id };
  },

  async getLastId() {
    const all = await db.select({ id: reports.id }).from(reports);
    if (all.length === 0) return 0;
    const nums = all.map((r) => parseInt(r.id.replace("REP-", ""), 10)).filter(n => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : 0;
  },
};
