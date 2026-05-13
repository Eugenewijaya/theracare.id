import { db } from "../db/index.js";
import { children, parents, reports, rooms as clinicRooms, therapySessions } from "../db/schema.js";
import { eq, and, inArray } from "drizzle-orm";
import { generateSeqId } from "../utils/id-generators.js";
import { notificationService } from "./notification.service.js";
import { httpError } from "../utils/http-error.js";

type ReportInsert = typeof reports.$inferInsert;
type ReportQueryOptions = { visibleToParentOnly?: boolean; therapistId?: string };
type ReportUpdateOptions = { allowStatus?: boolean };

const PARENT_VISIBLE_REPORT_STATUSES = ["approved", "published", "ready_for_parent"];
const REVIEWABLE_REPORT_STATUSES = ["approved", "published", "ready_for_parent", "needs_revision", "pending_review"];
const COMPLETED_SESSION_STATUSES = ["done", "completed", "selesai"];
const PUBLISHED_EDIT_WINDOW_HOURS = 48;
const PUBLISHED_EDIT_WINDOW_MS = PUBLISHED_EDIT_WINDOW_HOURS * 60 * 60 * 1000;

function isParentVisibleReport(status?: string | null) {
  return !!status && PARENT_VISIBLE_REPORT_STATUSES.includes(status);
}

function normalizeDateValue(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value).split("T")[0];
}

function sessionSortKey(session: { date?: unknown; startTime?: string | null }) {
  return `${normalizeDateValue(session.date)} ${session.startTime || "00:00"}`;
}

function toIso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getPublishedAt(report: any) {
  const reviewLog = Array.isArray(report?.reviewLog) ? report.reviewLog : [];
  for (let index = reviewLog.length - 1; index >= 0; index -= 1) {
    const entry = reviewLog[index];
    if (isParentVisibleReport(entry?.status)) {
      const createdAt = toIso(entry.createdAt);
      if (createdAt) return createdAt;
    }
  }
  return isParentVisibleReport(report?.status)
    ? toIso(report?.updatedAt) || toIso(report?.createdAt)
    : null;
}

function getReportEditWindow(report: any, now = new Date()) {
  const publishedAt = getPublishedAt(report);
  if (!isParentVisibleReport(report?.status)) {
    return {
      isParentVisible: false,
      canEdit: true,
      editLocked: false,
      publishedAt,
      editDeadline: null,
      editWindowHours: PUBLISHED_EDIT_WINDOW_HOURS,
    };
  }
  if (!publishedAt) {
    return {
      isParentVisible: true,
      canEdit: false,
      editLocked: true,
      publishedAt: null,
      editDeadline: null,
      editWindowHours: PUBLISHED_EDIT_WINDOW_HOURS,
    };
  }
  const deadline = new Date(new Date(publishedAt).getTime() + PUBLISHED_EDIT_WINDOW_MS);
  const canEdit = now.getTime() <= deadline.getTime();
  return {
    isParentVisible: true,
    canEdit,
    editLocked: !canEdit,
    publishedAt,
    editDeadline: deadline.toISOString(),
    editWindowHours: PUBLISHED_EDIT_WINDOW_HOURS,
  };
}

function assertReportEditable(report: any) {
  const editWindow = getReportEditWindow(report);
  if (!editWindow.canEdit) {
    throw httpError(
      423,
      `Masa edit laporan yang sudah dipublikasikan sudah lewat ${PUBLISHED_EDIT_WINDOW_HOURS} jam.`,
      editWindow,
    );
  }
}

function cleanStringList(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is string => typeof item === "string" && !!item.trim())
    .map((item) => item.trim());
}

function appendReviewLog(existing: unknown, entry: { status: string; note?: string; actorRole?: string }) {
  const current = Array.isArray(existing) ? existing : [];
  return [
    ...current,
    {
      ...entry,
      createdAt: new Date().toISOString(),
    },
  ];
}

async function filterActiveRoomNames(input: unknown) {
  const requested = cleanStringList(input);
  if (!requested?.length) return [];
  const activeRooms = await db.select({ name: clinicRooms.name })
    .from(clinicRooms)
    .where(and(inArray(clinicRooms.name, requested), eq(clinicRooms.status, "active")));
  const allowed = new Set(activeRooms.map((room) => room.name));
  return requested.filter((roomName) => allowed.has(roomName));
}

function formatReport(report: any) {
  if (!report) return null;
  const editWindow = getReportEditWindow(report);
  return {
    ...report,
    childName: report.child?.name || report.childName || "",
    therapistName: report.therapist?.user?.name || report.therapistName || "",
    ...editWindow,
  };
}

function pickReportValues(data: any, options: ReportUpdateOptions = { allowStatus: true }): Partial<ReportInsert> {
  return {
    ...(typeof data.type === "string" ? { type: data.type } : {}),
    ...(typeof data.childId === "string" ? { childId: data.childId } : {}),
    ...(typeof data.therapistId === "string" ? { therapistId: data.therapistId } : {}),
    ...(typeof data.therapyPeriodId === "string" && data.therapyPeriodId ? { therapyPeriodId: data.therapyPeriodId } : {}),
    ...(typeof data.sessionId === "string" && data.sessionId ? { sessionId: data.sessionId } : {}),
    ...(options.allowStatus !== false && typeof data.status === "string" ? { status: data.status } : {}),
    ...(typeof data.date === "string" ? { date: data.date } : {}),
    ...(typeof data.sessionFocus === "string" ? { sessionFocus: data.sessionFocus } : {}),
    ...(typeof data.sessionType === "string" ? { sessionType: data.sessionType } : {}),
    ...(Array.isArray(data.aspects) ? { aspects: data.aspects } : {}),
    ...(data.evaluations && typeof data.evaluations === "object" ? { evaluations: data.evaluations } : {}),
    ...(Number.isFinite(Number(data.sessionScore)) ? { sessionScore: Number(data.sessionScore) } : {}),
    ...(typeof data.description === "string" ? { description: data.description } : {}),
    ...(Array.isArray(data.toysUsed) ? { toysUsed: cleanStringList(data.toysUsed) } : {}),
    ...(Array.isArray(data.roomsUsed) ? { roomsUsed: cleanStringList(data.roomsUsed) } : {}),
    ...(Array.isArray(data.toolsUsed) ? { toolsUsed: cleanStringList(data.toolsUsed) } : {}),
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
      with: { child: true, therapist: { with: { user: true } }, session: true, therapyPeriod: { with: { program: true } } },
    });
    return formatReport(report);
  },

  async getForTherapist(therapistId: string, type?: string) {
    const conditions = [eq(reports.therapistId, therapistId)];
    if (type) conditions.push(eq(reports.type, type));
    const rows = await db.query.reports.findMany({
      where: and(...conditions),
      with: { child: true, session: true, therapyPeriod: { with: { program: true } } },
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
      with: { therapist: { with: { user: true } }, session: true, therapyPeriod: { with: { program: true } } },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
    return rows.map(formatReport);
  },

  async getAll(status?: string) {
    const conditions: any[] = [];
    if (status) conditions.push(eq(reports.status, status));
    const rows = await db.query.reports.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      with: { child: true, therapist: { with: { user: true } }, session: true, therapyPeriod: { with: { program: true } } },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
    return rows.map(formatReport);
  },

  async getSessionReport(sessionId: string) {
    const report = await db.query.reports.findFirst({
      where: and(eq(reports.type, "harian"), eq(reports.sessionId, sessionId)),
      with: { child: true, therapist: { with: { user: true } }, session: true, therapyPeriod: { with: { program: true } } },
    });
    return formatReport(report);
  },

  async getMissingPriorDailyReports(sessionId: string) {
    const targetSession = await db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, sessionId),
      with: { child: true, therapist: { with: { user: true } } },
    });
    if (!targetSession) return [];

    const completedSessions = await db.query.therapySessions.findMany({
      where: and(
        eq(therapySessions.therapistId, targetSession.therapistId),
        eq(therapySessions.childId, targetSession.childId),
        inArray(therapySessions.status, COMPLETED_SESSION_STATUSES),
      ),
      with: { child: true, therapist: { with: { user: true } } },
      orderBy: (s, { asc }) => [asc(s.date), asc(s.startTime)],
    });

    const targetKey = sessionSortKey(targetSession);
    const priorSessions = completedSessions.filter((session) => (
      session.id !== sessionId && sessionSortKey(session) < targetKey
    ));
    if (priorSessions.length === 0) return [];

    const existingReports = await db.query.reports.findMany({
      where: and(
        eq(reports.type, "harian"),
        inArray(reports.sessionId, priorSessions.map((session) => session.id)),
      ),
    });
    const reportedSessionIds = new Set(existingReports.map((report) => report.sessionId).filter(Boolean));
    return priorSessions
      .filter((session) => !reportedSessionIds.has(session.id))
      .map((session) => ({
        id: session.id,
        childId: session.childId,
        childName: session.child?.name || "",
        therapistId: session.therapistId,
        therapistName: session.therapist?.user?.name || "",
        date: normalizeDateValue(session.date),
        startTime: session.startTime,
        focus: session.focus,
      }));
  },

  async assertNoPriorMissingDailyReports(data: any) {
    if (data?.type !== "harian" || !data?.sessionId) return;
    const missing = await this.getMissingPriorDailyReports(data.sessionId);
    if (missing.length === 0) return;
    const first = missing[0];
    throw httpError(
      409,
      `Selesaikan laporan sesi sebelumnya terlebih dahulu: ${first.childName || "anak"} pada ${first.date} ${first.startTime || ""}.`,
      { missingReports: missing },
    );
  },

  async save(data: any) {
    const now = new Date();
    if (Array.isArray(data.roomsUsed)) {
      data.roomsUsed = await filterActiveRoomNames(data.roomsUsed);
    }
    let therapyPeriodId = typeof data.therapyPeriodId === "string" ? data.therapyPeriodId : "";
    const linkedSession = data.sessionId
      ? await db.query.therapySessions.findFirst({ where: eq(therapySessions.id, data.sessionId) })
      : null;
    if (!therapyPeriodId && linkedSession) {
      therapyPeriodId = linkedSession.therapyPeriodId || "";
    }
    if (data.type === "harian" && data.sessionId && !linkedSession) {
      throw httpError(404, "Sesi terapi tidak ditemukan.");
    }
    if (data.type === "harian" && linkedSession) {
      if (linkedSession.therapistId !== data.therapistId || linkedSession.childId !== data.childId) {
        throw httpError(403, "Laporan harian hanya bisa dibuat untuk sesi terapis dan anak yang sesuai.");
      }
    }
    await this.assertNoPriorMissingDailyReports(data);

    // Check if updating existing report
    if (data.id) {
      const existing = await db.query.reports.findFirst({ where: eq(reports.id, data.id) });
      if (!existing) return null;
      if (existing.therapistId !== data.therapistId) {
        throw httpError(403, "Akses ubah laporan ditolak.");
      }
      assertReportEditable(existing);
      const logUpdate = existing?.status === "needs_revision"
        ? { reviewLog: appendReviewLog(existing.reviewLog, { status: "resubmitted", note: "Terapis mengirim revisi laporan.", actorRole: "therapist" }) }
        : {};
      const [updated] = await db.update(reports)
        .set({ ...pickReportValues({ ...data, therapyPeriodId }, { allowStatus: false }), ...logUpdate, status: "pending_review", updatedAt: now })
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
        if (existing.therapistId !== data.therapistId) {
          throw httpError(403, "Akses ubah laporan ditolak.");
        }
        assertReportEditable(existing);
        const logUpdate = existing.status === "needs_revision"
          ? { reviewLog: appendReviewLog(existing.reviewLog, { status: "resubmitted", note: "Terapis mengirim revisi laporan.", actorRole: "therapist" }) }
          : {};
        const [updated] = await db.update(reports)
          .set({ ...pickReportValues({ ...data, therapyPeriodId }, { allowStatus: false }), ...logUpdate, status: "pending_review", updatedAt: now })
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
      ...pickReportValues({ ...data, therapyPeriodId }),
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

  async updateStatus(id: string, status: string, reviewNote?: string, actorRole?: string) {
    if (!REVIEWABLE_REPORT_STATUSES.includes(status)) {
      throw httpError(400, "Status laporan tidak valid.");
    }
    const existing = await db.query.reports.findFirst({
      where: eq(reports.id, id),
      with: { therapist: { with: { user: true } }, child: true },
    });
    if (!existing) return null;

    const note = String(reviewNote || "").trim();
    if (status === "needs_revision" && note.length < 8) {
      throw httpError(400, "Alasan revisi wajib diisi sebelum laporan dikembalikan ke terapis.");
    }
    if (isParentVisibleReport(existing.status) && status === "needs_revision") {
      assertReportEditable(existing);
    }

    const [updated] = await db.update(reports)
      .set({
        status,
        reviewLog: appendReviewLog(existing.reviewLog, { status, note, actorRole }),
        updatedAt: new Date(),
      })
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
    if (updated && status === "needs_revision" && existing.therapist?.userId) {
      await notificationService.create({
        type: "report_revision_requested",
        icon: "rate_review",
        title: "Laporan perlu revisi",
        message: note || `Admin meminta revisi laporan ${existing.child?.name || "anak"}.`,
        targetRole: "therapist",
        targetUserId: existing.therapist.userId,
        relatedId: id,
      });
    }
    return formatReport(updated);
  },

  async update(id: string, updates: any, options: ReportUpdateOptions = {}) {
    const existing = await db.query.reports.findFirst({ where: eq(reports.id, id) });
    if (!existing) return null;
    assertReportEditable(existing);
    if (Array.isArray(updates.roomsUsed)) {
      updates.roomsUsed = await filterActiveRoomNames(updates.roomsUsed);
    }
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
