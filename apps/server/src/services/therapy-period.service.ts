import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { children, historicalSessionSummaries, migrationRecords, programs, reports, therapists, therapyPeriods, therapyPrograms, therapySessions } from "../db/schema.js";
import { generateId } from "../utils/id-generators.js";
import { evaluateSessionSlot } from "./scheduling-availability.service.js";
import { notificationService } from "./notification.service.js";

type TherapyPeriodInsert = typeof therapyPeriods.$inferInsert;
type TherapySessionInsert = typeof therapySessions.$inferInsert;

type ScheduleRule = {
  day?: string;
  dayOfWeek?: number;
  startTime?: string;
  duration?: string;
  therapistId?: string;
  roomId?: string;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const RESET_SEQUENCE_PERIOD_STATUSES = new Set(["cancelled", "deleted", "rejected"]);
const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  minggu: 0,
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  sabtu: 6,
};

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDayOfWeek(rule: ScheduleRule) {
  if (Number.isInteger(rule.dayOfWeek) && Number(rule.dayOfWeek) >= 0 && Number(rule.dayOfWeek) <= 6) {
    return Number(rule.dayOfWeek);
  }
  const key = String(rule.day || "").trim().toLowerCase();
  return Number.isInteger(DAY_INDEX[key]) ? DAY_INDEX[key] : null;
}

function normalizeScheduleRules(input: unknown, fallbackTherapistId?: string) {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      const rule = raw as ScheduleRule;
      const dayOfWeek = parseDayOfWeek(rule);
      const startTime = typeof rule.startTime === "string" && rule.startTime ? rule.startTime : "";
      if (dayOfWeek === null || !startTime) return null;
      return {
        day: rule.day || DAY_NAMES[dayOfWeek],
        dayOfWeek,
        startTime,
        duration: typeof rule.duration === "string" && rule.duration ? rule.duration : "60 mins",
        therapistId: typeof rule.therapistId === "string" && rule.therapistId ? rule.therapistId : fallbackTherapistId,
        roomId: typeof rule.roomId === "string" && rule.roomId ? rule.roomId : undefined,
      };
    })
    .filter((rule): rule is NonNullable<typeof rule> => !!rule);
}

function normalizeGoals(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.filter((goal): goal is string => typeof goal === "string" && !!goal.trim()).map((goal) => goal.trim());
}

function normalizeTherapistIds(input: unknown, primaryTherapistId?: string) {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input
    .filter((id): id is string => typeof id === "string" && !!id.trim())
    .map((id) => id.trim())
    .filter((id) => id !== primaryTherapistId)));
}

function normalizeComparableText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getSequenceProgramId(scope: any) {
  return typeof scope?.programId === "string" && scope.programId
    ? scope.programId
    : typeof scope?.therapyProgram?.programId === "string" && scope.therapyProgram.programId
      ? scope.therapyProgram.programId
      : "";
}

function getSequenceProgramName(scope: any) {
  return normalizeComparableText(
    scope?.type
      || scope?.programName
      || scope?.program?.name
      || scope?.therapyProgram?.type
  );
}

function matchesSequenceScope(row: any, scope: any = {}) {
  const programId = getSequenceProgramId(scope);
  const programName = getSequenceProgramName(scope);

  if (programId) {
    const rowProgramId = getSequenceProgramId(row);
    if (rowProgramId === programId) return true;
    return Boolean(programName && getSequenceProgramName(row) === programName);
  }

  const therapyProgramId = Number(scope?.therapyProgramId);
  if (Number.isFinite(therapyProgramId) && therapyProgramId > 0) {
    return Number(row?.therapyProgramId) === therapyProgramId;
  }

  if (programName) return getSequenceProgramName(row) === programName;

  return true;
}

function calculateTotalPrice(data: {
  billingMode?: string;
  pricePerSession?: number;
  pricePerMonth?: number;
  totalPrice?: number;
  totalSessions?: number;
}) {
  const explicit = Number(data.totalPrice || 0);
  if (explicit > 0) return explicit;
  if (data.billingMode === "per_month") return Number(data.pricePerMonth || 0);
  return Number(data.pricePerSession || 0) * Number(data.totalSessions || 0);
}

function pickPeriodValues(data: any): Partial<TherapyPeriodInsert> {
  const totalSessions = Number(data.totalSessions);
  const pricePerSession = Number(data.pricePerSession || 0);
  const pricePerMonth = Number(data.pricePerMonth || 0);
  const billingMode = typeof data.billingMode === "string" ? data.billingMode : "per_session";
  const normalizedScheduleRules = Array.isArray(data.scheduleRules)
    ? normalizeScheduleRules(data.scheduleRules, data.therapistId)
    : [];
  const primaryTherapistId = typeof data.therapistId === "string" && data.therapistId
    ? data.therapistId
    : normalizedScheduleRules.find((rule) => !!rule.therapistId)?.therapistId || "";
  return {
    ...(typeof data.therapyProgramId === "number" ? { therapyProgramId: data.therapyProgramId } : {}),
    ...(typeof data.programId === "string" && data.programId ? { programId: data.programId } : {}),
    ...(Number.isFinite(Number(data.periodNumber)) ? { periodNumber: Number(data.periodNumber) } : {}),
    ...(typeof data.name === "string" && data.name.trim() ? { name: data.name.trim() } : {}),
    ...(typeof data.status === "string" ? { status: data.status } : {}),
    ...(typeof data.startDate === "string" && data.startDate ? { startDate: data.startDate } : {}),
    ...(typeof data.endDate === "string" && data.endDate ? { endDate: data.endDate } : {}),
    ...(Number.isFinite(totalSessions) ? { totalSessions } : {}),
    ...(Number.isFinite(Number(data.completedSessions)) ? { completedSessions: Number(data.completedSessions) } : {}),
    ...(Number.isFinite(pricePerSession) ? { pricePerSession } : {}),
    ...(Number.isFinite(pricePerMonth) ? { pricePerMonth } : {}),
    billingMode,
    totalPrice: calculateTotalPrice({ billingMode, pricePerSession, pricePerMonth, totalSessions, totalPrice: Number(data.totalPrice || 0) }),
    ...(Array.isArray(data.scheduleRules) ? { scheduleRules: normalizedScheduleRules } : {}),
    ...(Array.isArray(data.assistantTherapistIds) ? { assistantTherapistIds: normalizeTherapistIds(data.assistantTherapistIds, primaryTherapistId) } : {}),
    ...(Array.isArray(data.goals) ? { goals: normalizeGoals(data.goals) } : {}),
    ...(typeof data.notes === "string" ? { notes: data.notes.trim() } : {}),
    ...(typeof data.renewalOf === "string" ? { renewalOf: data.renewalOf } : {}),
    ...(typeof data.finalReportId === "string" ? { finalReportId: data.finalReportId } : {}),
    updatedAt: new Date(),
  };
}

function normalizePeriod(period: any) {
  if (!period) return null;
  const sessions = Array.isArray(period.sessions) ? period.sessions : [];
  const historicalSummaries = Array.isArray(period.historicalSummaries) ? period.historicalSummaries : [];
  const historicalCompletedSessions = historicalSummaries.reduce((sum: number, summary: any) => sum + Number(summary.completedCount || 0), 0);
  const completedFromSessions = sessions.filter((session: any) => session.status === "done" || session.status === "completed").length;
  const completedSessions = historicalCompletedSessions > 0
    ? Math.max(Number(period.completedSessions || 0), historicalCompletedSessions + completedFromSessions)
    : Math.max(Number(period.completedSessions || 0), completedFromSessions);
  const totalSessions = Number(period.totalSessions || sessions.length || 0);
  const programName = period.program?.name || period.therapyProgram?.type || "Program Terapi";
  const progress = totalSessions > 0 ? Math.min(100, Math.round((completedSessions / totalSessions) * 100)) : 0;
  return {
    ...period,
    programName,
    completedSessions,
    totalSessions,
    progress,
    sessionLabel: totalSessions > 0 ? `${completedSessions}/${totalSessions} sesi` : `${completedSessions} sesi selesai`,
    pricePerSession: Number(period.pricePerSession || 0),
    pricePerMonth: Number(period.pricePerMonth || 0),
    totalPrice: Number(period.totalPrice || 0),
    historicalOpeningBalance: {
      completedCount: historicalCompletedSessions,
      firstKnownDate: historicalSummaries[0]?.firstKnownDate || null,
      lastKnownDate: historicalSummaries[0]?.lastKnownDate || null,
      sourceNote: historicalSummaries[0]?.sourceNote || "",
    },
  };
}

async function getNextPeriodNumber(childId: string, scope: any = {}) {
  const rows = await db.query.therapyPeriods.findMany({
    where: eq(therapyPeriods.childId, childId),
    with: { program: true, therapyProgram: true },
  });
  const sequenceRows = rows
    .filter((row) => !RESET_SEQUENCE_PERIOD_STATUSES.has(String(row.status || "").toLowerCase()))
    .filter((row) => matchesSequenceScope(row, scope));
  return sequenceRows.reduce((max, row) => Math.max(max, Number(row.periodNumber || 0)), 0) + 1;
}

async function notifyPeriodCreated(periodId: string, generation?: { created?: unknown[] }) {
  const period = await db.query.therapyPeriods.findFirst({
    where: eq(therapyPeriods.id, periodId),
    with: {
      child: { with: { parent: { with: { user: true } } } },
      program: true,
      therapyProgram: true,
    },
  });
  if (!period) return;

  const programName = period.program?.name || period.therapyProgram?.type || "Program Terapi";
  const childName = period.child?.name || period.childId;
  const sessionCount = Number(period.totalSessions || 0);
  const createdCount = Array.isArray(generation?.created) ? generation.created.length : 0;
  const scheduleText = createdCount > 0
    ? `${createdCount} sesi awal dibuat.`
    : `${sessionCount} sesi direncanakan.`;

  await notificationService.create({
    type: "program_enrollment",
    icon: "playlist_add_check",
    title: "Periode terapi baru selesai dibuat",
    message: `${childName} didaftarkan ke ${programName} (${period.name}) mulai ${period.startDate}. ${scheduleText}`,
    targetRole: "admin",
    relatedId: period.id,
  });

  if (period.child?.parent?.userId) {
    await notificationService.create({
      type: "program_enrollment",
      icon: "playlist_add_check",
      title: "Program terapi anak didaftarkan",
      message: `${childName} didaftarkan ke ${programName} (${period.name}) mulai ${period.startDate}. ${scheduleText}`,
      targetRole: "parent",
      targetUserId: period.child.parent.userId,
      relatedId: period.id,
    });
  }

  const therapistIds = Array.from(new Set([
    ...((period.scheduleRules || [])
      .map((rule: any) => rule?.therapistId)
      .filter((id): id is string => typeof id === "string" && !!id)),
    ...((Array.isArray(period.assistantTherapistIds) ? period.assistantTherapistIds : [])
      .filter((id): id is string => typeof id === "string" && !!id)),
  ]));
  for (const therapistId of therapistIds) {
    const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, therapistId) });
    if (!therapist?.userId) continue;
    await notificationService.create({
      type: "program_enrollment",
      icon: "event_available",
      title: "Periode terapi baru ditugaskan",
      message: `${childName} - ${programName} (${period.name}) mulai ${period.startDate}. ${scheduleText}`,
      targetRole: "therapist",
      targetUserId: therapist.userId,
      relatedId: period.id,
    });
  }
}

async function findOrCreateTherapyProgram(data: any) {
  if (Number.isFinite(Number(data.therapyProgramId))) {
    const existing = await db.query.therapyPrograms.findFirst({ where: eq(therapyPrograms.id, Number(data.therapyProgramId)) });
    if (existing) return existing;
  }

  const childId = String(data.childId || "");
  const programId = typeof data.programId === "string" && data.programId ? data.programId : "";
  const type = typeof data.type === "string" && data.type.trim() ? data.type.trim() : "";

  if (programId) {
    const existing = await db.query.therapyPrograms.findFirst({
      where: and(eq(therapyPrograms.childId, childId), eq(therapyPrograms.programId, programId)),
    });
    if (existing) return existing;
  } else if (type) {
    const existing = await db.query.therapyPrograms.findFirst({
      where: and(eq(therapyPrograms.childId, childId), eq(therapyPrograms.type, type)),
    });
    if (existing) return existing;
  }

  const linkedProgram = programId
    ? await db.query.programs.findFirst({ where: eq(programs.id, programId) })
    : null;

  const [created] = await db.insert(therapyPrograms).values({
    childId,
    programId: linkedProgram?.id || programId || null,
    type: linkedProgram?.name || type || "Program Terapi",
    totalSessions: Number(data.totalSessions || 0),
    goal: typeof data.goal === "string" ? data.goal : "",
    colorClass: typeof data.colorClass === "string" ? data.colorClass : "emerald",
  }).returning();
  return created;
}

export const therapyPeriodService = {
  async getAll(filters: { childId?: string; status?: string } = {}) {
    const conditions = [];
    if (filters.childId) conditions.push(eq(therapyPeriods.childId, filters.childId));
    if (filters.status) conditions.push(eq(therapyPeriods.status, filters.status));
    const rows = await db.query.therapyPeriods.findMany({
      ...(conditions.length > 0 ? { where: and(...conditions) } : {}),
      with: {
        child: { with: { parent: { with: { user: true } } } },
        program: true,
        therapyProgram: true,
        sessions: true,
        reports: true,
        historicalSummaries: true,
      },
      orderBy: (p, { desc }) => [desc(p.startDate), desc(p.createdAt)],
    });
    return rows.map(normalizePeriod);
  },

  async getById(id: string) {
    const row = await db.query.therapyPeriods.findFirst({
      where: eq(therapyPeriods.id, id),
      with: {
        child: { with: { parent: { with: { user: true } } } },
        program: true,
        therapyProgram: true,
        sessions: { with: { therapist: { with: { user: true } }, room: true } },
        reports: true,
        historicalSummaries: true,
      },
    });
    return normalizePeriod(row);
  },

  async create(data: any) {
    const childId = String(data.childId || "");
    const child = await db.query.children.findFirst({ where: eq(children.id, childId) });
    if (!child) return null;
    const generationRules = normalizeScheduleRules(data.scheduleRules, data.therapistId);
    if (data.generateSessions) {
      if (generationRules.length === 0) {
        throw new Error("Pilih minimal satu hari terapi, jam mulai, dan terapis utama sebelum membuat jadwal sesi.");
      }
      if (generationRules.some((rule) => !rule.therapistId)) {
        throw new Error("Setiap aturan jadwal wajib memiliki therapistId.");
      }
    }

    const therapyProgram = await findOrCreateTherapyProgram({ ...data, childId });
    const requestedPeriodNumber = Number(data.periodNumber);
    const periodNumber = Number.isFinite(requestedPeriodNumber) && requestedPeriodNumber > 0
      ? requestedPeriodNumber
      : await getNextPeriodNumber(childId, {
        ...data,
        therapyProgramId: therapyProgram.id,
        programId: data.programId || therapyProgram.programId,
        type: data.type || therapyProgram.type,
      });
    const startDate = typeof data.startDate === "string" && data.startDate ? data.startDate : new Date().toISOString().split("T")[0];
    const values = pickPeriodValues({
      ...data,
      childId,
      therapyProgramId: therapyProgram.id,
      programId: data.programId || therapyProgram.programId,
      scheduleRules: Array.isArray(data.scheduleRules) ? generationRules : data.scheduleRules,
      periodNumber,
      name: data.name || `Periode ${periodNumber}`,
      startDate,
      totalSessions: Number(data.totalSessions || therapyProgram.totalSessions || 12),
      goal: data.goal || therapyProgram.goal || "",
    });

    const [period] = await db.insert(therapyPeriods).values({
      id: generateId("PER"),
      childId,
      therapyProgramId: therapyProgram.id,
      programId: data.programId || therapyProgram.programId || null,
      periodNumber,
      name: data.name || `Periode ${periodNumber}`,
      startDate,
      status: "active",
      ...values,
    }).returning();

    await db.update(therapyPrograms)
      .set({
        totalSessions: Number(values.totalSessions || therapyProgram.totalSessions || 0),
        goal: typeof data.goal === "string" ? data.goal : therapyProgram.goal,
      })
      .where(eq(therapyPrograms.id, therapyProgram.id));

    const generation = data.generateSessions
      ? await this.generateSessions(period.id, { scheduleRules: generationRules })
      : null;

    await notifyPeriodCreated(period.id, generation || undefined);

    const hydrated = await this.getById(period.id);
    return generation
      ? { ...hydrated, sessionGeneration: { created: generation.created.length, skipped: generation.skipped || [] } }
      : hydrated;
  },

  async update(id: string, updates: any) {
    const values = pickPeriodValues(updates);
    if (Object.keys(values).length === 0) return this.getById(id);
    const [updated] = await db.update(therapyPeriods).set(values).where(eq(therapyPeriods.id, id)).returning();
    if (!updated) return null;
    return this.getById(id);
  },

  async complete(id: string, data: { finalReportId?: string; notes?: string } = {}) {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(therapySessions)
      .where(and(eq(therapySessions.therapyPeriodId, id), eq(therapySessions.status, "done")));
    const [historicalRow] = await db
      .select({ count: sql<number>`coalesce(sum(${historicalSessionSummaries.completedCount}), 0)` })
      .from(historicalSessionSummaries)
      .where(eq(historicalSessionSummaries.therapyPeriodId, id));
    const [updated] = await db.update(therapyPeriods)
      .set({
        status: "completed",
        completedSessions: Number(countRow?.count || 0) + Number(historicalRow?.count || 0),
        ...(data.finalReportId ? { finalReportId: data.finalReportId } : {}),
        ...(data.notes ? { notes: data.notes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(therapyPeriods.id, id))
      .returning();
    if (!updated) return null;
    return this.getById(id);
  },

  async renew(id: string, data: any = {}) {
    const source = await db.query.therapyPeriods.findFirst({ where: eq(therapyPeriods.id, id) });
    if (!source) return null;
    if (String(source.status || "").toLowerCase() !== "completed") {
      throw new Error("Periode hanya bisa dilanjutkan jika periode sebelumnya sudah selesai. Periode yang dibatalkan harus dibuat ulang dari Periode 1.");
    }
    const nextPeriodNumber = await getNextPeriodNumber(source.childId, source);
    return this.create({
      ...source,
      ...data,
      childId: source.childId,
      therapyProgramId: source.therapyProgramId,
      programId: source.programId,
      renewalOf: source.id,
      status: data.status || "active",
      periodNumber: nextPeriodNumber,
      name: data.name || `Periode ${nextPeriodNumber}`,
      completedSessions: 0,
      finalReportId: undefined,
      generateSessions: data.generateSessions || false,
    });
  },

  async deleteCancelled(id: string) {
    const period = await db.query.therapyPeriods.findFirst({ where: eq(therapyPeriods.id, id) });
    if (!period) return null;
    if (String(period.status || "").toLowerCase() !== "cancelled") {
      throw new Error("Hanya periode yang sudah dibatalkan yang bisa dihapus permanen dari riwayat.");
    }

    await db.transaction(async (tx) => {
      await tx.update(therapySessions)
        .set({ therapyPeriodId: null })
        .where(eq(therapySessions.therapyPeriodId, id));
      await tx.update(reports)
        .set({ therapyPeriodId: null })
        .where(eq(reports.therapyPeriodId, id));
      await tx.update(migrationRecords)
        .set({ therapyPeriodId: null })
        .where(eq(migrationRecords.therapyPeriodId, id));
      await tx.delete(historicalSessionSummaries).where(eq(historicalSessionSummaries.therapyPeriodId, id));
      await tx.delete(therapyPeriods).where(eq(therapyPeriods.id, id));
      if (period.therapyProgramId) {
        const [remainingPeriod] = await tx
          .select({ id: therapyPeriods.id })
          .from(therapyPeriods)
          .where(eq(therapyPeriods.therapyProgramId, period.therapyProgramId))
          .limit(1);
        if (!remainingPeriod) {
          await tx.delete(therapyPrograms).where(eq(therapyPrograms.id, period.therapyProgramId));
        }
      }
    });

    return { deleted: true, id, childId: period.childId, name: period.name };
  },

  async generateSessions(id: string, options: { scheduleRules?: ScheduleRule[] } = {}) {
    const period = await db.query.therapyPeriods.findFirst({
      where: eq(therapyPeriods.id, id),
      with: { program: true, therapyProgram: true, sessions: true },
    });
    if (!period) return null;

    const rules = normalizeScheduleRules(options.scheduleRules || period.scheduleRules || []);
    if (rules.length === 0) return { period: normalizePeriod(period), created: [] };
    if (rules.some((rule) => !rule.therapistId)) {
      throw new Error("Setiap aturan jadwal wajib memiliki therapistId.");
    }

    const start = new Date(`${period.startDate}T00:00:00`);
    const hardEnd = period.endDate
      ? new Date(`${period.endDate}T00:00:00`)
      : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
    const limit = Math.max(0, Number(period.totalSessions || 0));
    const existing = Array.isArray(period.sessions) ? period.sessions : [];
    const existingKeys = new Set(existing.map((session: any) => `${session.date}|${session.startTime}|${session.therapistId}`));
    const values: TherapySessionInsert[] = [];
    const skipped: Array<{ date: string; startTime: string; therapistId: string; reason?: string }> = [];

    for (let cursor = new Date(start); cursor <= hardEnd && (limit === 0 || existing.length + values.length < limit); cursor.setDate(cursor.getDate() + 1)) {
      const dayRules = rules.filter((rule) => rule.dayOfWeek === cursor.getDay());
      for (const rule of dayRules) {
        if (limit > 0 && existing.length + values.length >= limit) break;
        const date = toDateString(cursor);
        const key = `${date}|${rule.startTime}|${rule.therapistId}`;
        if (existingKeys.has(key)) continue;
        const availability = await evaluateSessionSlot({
          therapistId: rule.therapistId!,
          childId: period.childId,
          roomId: rule.roomId || null,
          date,
          startTime: rule.startTime,
          duration: rule.duration || "60 mins",
        });
        if (availability.status !== "available") {
          skipped.push({ date, startTime: rule.startTime, therapistId: rule.therapistId!, reason: availability.reason });
          continue;
        }
        existingKeys.add(key);
        values.push({
          id: `S-PER-${Date.now()}-${values.length}`,
          therapyPeriodId: period.id,
          therapistId: rule.therapistId!,
          childId: period.childId,
          roomId: rule.roomId || null,
          date,
          startTime: rule.startTime,
          duration: rule.duration || "60 mins",
          focus: period.program?.name || period.therapyProgram?.type || "Program Terapi",
          status: "upcoming",
        });
      }
    }

    const created = values.length > 0 ? await db.insert(therapySessions).values(values).returning() : [];
    return { period: await this.getById(id), created, skipped };
  },
};
