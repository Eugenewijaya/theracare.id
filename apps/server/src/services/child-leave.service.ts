import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicSettings, therapists, therapyPeriods, therapySessions } from "../db/schema.js";
import { generateId } from "../utils/id-generators.js";
import { dateKeyFromDate, normalizeDateKey, parseDateKey, todayDateKey } from "../utils/date-key.js";
import { httpError } from "../utils/http-error.js";
import { notificationService } from "./notification.service.js";
import { evaluateSessionSlot } from "./scheduling-availability.service.js";
import { sessionService } from "./session.service.js";

const CHILD_LEAVE_REQUESTS_KEY = "childLeaveRequests";
const CHILD_LEAVE_WRITE_LOCK = "child-leaves:write";
const VALID_CHANNELS = new Set(["whatsapp", "phone", "in_person", "other"]);
const ACTIVE_STATUSES = new Set(["draft", "confirmed", "revised"]);
const MOVABLE_IMPACT_STATUSES = new Set(["planned", "move_failed"]);
const RESTORABLE_IMPACT_STATUSES = new Set(["moved", "kept_replacement", "restore_failed"]);
const SEARCH_DAYS = 240;

type DbClient = typeof db | any;
type ChildLeaveStatus = "draft" | "confirmed" | "revised" | "cancelled";
type ChildLeaveImpactStatus =
  | "planned"
  | "moved"
  | "move_failed"
  | "restored"
  | "restore_failed"
  | "kept_replacement"
  | "not_applicable";

type ChildLeaveImpact = {
  originalSessionId: string;
  originalDate: string;
  originalStartTime: string;
  therapistId: string;
  therapistName: string;
  therapistUserId?: string;
  roomId?: string;
  duration?: string;
  focus?: string;
  therapyPeriodId?: string;
  status: ChildLeaveImpactStatus;
  replacementSessionId?: string;
  replacementDate?: string;
  replacementStartTime?: string;
  restoredSessionId?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

type ChildLeaveRevision = {
  action: "confirmed" | "revised" | "cancelled";
  previousStartDate?: string;
  previousEndDate?: string;
  nextStartDate?: string;
  nextEndDate?: string;
  strategy?: string;
  communicationChannel: string;
  communicationNote: string;
  actorId?: string;
  createdAt: string;
};

export type ChildLeaveRequest = {
  id: string;
  childId: string;
  childName: string;
  parentId?: string;
  parentUserId?: string;
  parentName?: string;
  parentPhone?: string;
  therapyPeriodId: string;
  periodName: string;
  periodStartDate?: string;
  periodEndDate?: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: ChildLeaveStatus;
  communicationChannel?: string;
  communicationNote?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  therapistUserIds?: string[];
  impacts: ChildLeaveImpact[];
  revisionHistory: ChildLeaveRevision[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

function parseRequests(value?: string | null): ChildLeaveRequest[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? parsed.map((request) => ({
          ...request,
          impacts: Array.isArray(request?.impacts) ? request.impacts : [],
          revisionHistory: Array.isArray(request?.revisionHistory) ? request.revisionHistory : [],
        }))
      : [];
  } catch {
    return [];
  }
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Boolean(parseDateKey(value));
}

function normalizeRange(startDate: unknown, endDate: unknown) {
  const start = normalizeDateKey(startDate as string);
  const end = normalizeDateKey(endDate as string);
  if (!isDateKey(start) || !isDateKey(end)) throw httpError(400, "Tanggal mulai dan selesai cuti wajib diisi.");
  if (end < start) throw httpError(400, "Tanggal selesai cuti tidak boleh sebelum tanggal mulai.");
  return { startDate: start, endDate: end };
}

function normalizeCommunication(channel: unknown, note: unknown) {
  const communicationChannel = String(channel || "").trim().toLowerCase();
  const communicationNote = String(note || "").trim();
  if (!VALID_CHANNELS.has(communicationChannel)) {
    throw httpError(400, "Media konfirmasi wajib dipilih: WhatsApp, telepon, tatap muka, atau lainnya.");
  }
  if (!communicationNote) throw httpError(400, "Catatan/bukti konfirmasi dengan orang tua wajib diisi.");
  return { communicationChannel, communicationNote };
}

function addDays(dateKey: string, amount: number) {
  const date = parseDateKey(dateKey);
  if (!date) return "";
  date.setDate(date.getDate() + amount);
  return dateKeyFromDate(date);
}

function maxDateKey(...values: Array<string | undefined>) {
  return values.filter((value): value is string => isDateKey(value)).sort().at(-1) || "";
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}

function withinRange(date: string, request: Pick<ChildLeaveRequest, "startDate" | "endDate">) {
  return date >= request.startDate && date <= request.endDate;
}

function sortRequests(requests: ChildLeaveRequest[]) {
  return [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function sortImpacts(impacts: ChildLeaveImpact[]) {
  return [...impacts].sort((a, b) => (
    a.originalDate.localeCompare(b.originalDate)
    || a.originalStartTime.localeCompare(b.originalStartTime)
  ));
}

async function readRequests(client: DbClient = db) {
  const row = await client.query.clinicSettings.findFirst({
    where: eq(clinicSettings.key, CHILD_LEAVE_REQUESTS_KEY),
  });
  return parseRequests(row?.value);
}

async function writeRequests(requests: ChildLeaveRequest[], client: DbClient = db) {
  await client.insert(clinicSettings)
    .values({
      key: CHILD_LEAVE_REQUESTS_KEY,
      value: JSON.stringify(sortRequests(requests)),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: clinicSettings.key,
      set: { value: JSON.stringify(sortRequests(requests)), updatedAt: new Date() },
    });
}

async function withWriteLock<T>(callback: (tx: any) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${CHILD_LEAVE_WRITE_LOCK}))`);
    return callback(tx);
  });
}

async function mutateRequest(id: string, updater: (request: ChildLeaveRequest, requests: ChildLeaveRequest[]) => ChildLeaveRequest) {
  return withWriteLock(async (tx) => {
    const requests = await readRequests(tx);
    const index = requests.findIndex((request) => request.id === id);
    if (index === -1) throw httpError(404, "Pengajuan cuti anak tidak ditemukan.");
    const next = {
      ...updater(requests[index], requests),
      updatedAt: new Date().toISOString(),
    };
    requests[index] = next;
    await writeRequests(requests, tx);
    return next;
  });
}

async function mutateImpact(
  requestId: string,
  originalSessionId: string,
  updater: (impact: ChildLeaveImpact) => ChildLeaveImpact,
) {
  return mutateRequest(requestId, (request) => ({
    ...request,
    impacts: request.impacts.map((impact) => impact.originalSessionId === originalSessionId
      ? { ...updater(impact), updatedAt: new Date().toISOString() }
      : impact),
  }));
}

async function getContext(childId: string, therapyPeriodId: string) {
  const period = await db.query.therapyPeriods.findFirst({
    where: and(eq(therapyPeriods.id, therapyPeriodId), eq(therapyPeriods.childId, childId)),
    with: {
      child: { with: { parent: { with: { user: true } } } },
      program: true,
      therapyProgram: true,
    },
  });
  if (!period) throw httpError(404, "Periode terapi anak tidak ditemukan.");
  if (!["active", "planned"].includes(String(period.status || "").toLowerCase())) {
    throw httpError(409, "Cuti hanya dapat diterapkan pada periode terapi aktif atau terencana.");
  }
  const therapistIds = [...new Set([
    ...(Array.isArray(period.scheduleRules) ? period.scheduleRules : [])
      .map((rule: any) => rule?.therapistId)
      .filter((id: unknown): id is string => typeof id === "string" && Boolean(id)),
    ...(Array.isArray(period.assistantTherapistIds) ? period.assistantTherapistIds : [])
      .filter((id: unknown): id is string => typeof id === "string" && Boolean(id)),
  ])];
  const periodTherapists = therapistIds.length > 0
    ? await db.query.therapists.findMany({
        where: inArray(therapists.id, therapistIds),
        with: { user: true },
      })
    : [];
  return {
    period,
    childName: period.child?.name || period.childId,
    parentId: period.child?.parentId || period.child?.parent?.id || "",
    parentUserId: period.child?.parent?.userId || period.child?.parent?.user?.id || "",
    parentName: period.child?.parent?.user?.name || "",
    parentPhone: period.child?.parent?.user?.phone || "",
    periodName: period.name || period.program?.name || period.therapyProgram?.type || "Periode terapi",
    periodStartDate: normalizeDateKey(period.startDate),
    periodEndDate: normalizeDateKey(period.endDate),
    therapistUserIds: periodTherapists.map((therapist) => therapist.userId || therapist.user?.id).filter(Boolean),
  };
}

function assertRangeTouchesPeriod(
  range: { startDate: string; endDate: string },
  period: { periodStartDate?: string; periodEndDate?: string },
) {
  if (period.periodEndDate && range.startDate > period.periodEndDate) {
    throw httpError(400, "Tanggal cuti dimulai setelah periode terapi selesai.");
  }
  if (period.periodStartDate && range.endDate < period.periodStartDate) {
    throw httpError(400, "Tanggal cuti selesai sebelum periode terapi dimulai.");
  }
}

async function findImpactedSessions(childId: string, therapyPeriodId: string, startDate: string, endDate: string) {
  return db.query.therapySessions.findMany({
    where: sql`${therapySessions.childId} = ${childId}
      and ${therapySessions.therapyPeriodId} = ${therapyPeriodId}
      and ${therapySessions.date} >= ${startDate}
      and ${therapySessions.date} <= ${endDate}
      and ${therapySessions.status} not in ('cancelled', 'canceled', 'active', 'done', 'completed')`,
    with: { therapist: { with: { user: true } } },
    orderBy: (session, { asc }) => [asc(session.date), asc(session.startTime)],
  });
}

function buildImpact(session: any): ChildLeaveImpact {
  const now = new Date().toISOString();
  return {
    originalSessionId: session.id,
    originalDate: normalizeDateKey(session.date),
    originalStartTime: session.startTime,
    therapistId: session.therapistId,
    therapistName: session.therapist?.user?.name || session.therapist?.nit || session.therapistId,
    therapistUserId: session.therapist?.userId || session.therapist?.user?.id || "",
    roomId: session.roomId || "",
    duration: session.duration || "",
    focus: session.focus || "",
    therapyPeriodId: session.therapyPeriodId || "",
    status: "planned",
    createdAt: now,
    updatedAt: now,
  };
}

async function notifyParticipants(request: ChildLeaveRequest, title: string, message: string) {
  await notificationService.create({
    type: "child_leave",
    icon: "event_busy",
    title,
    message,
    targetRole: "admin",
    relatedId: request.id,
  });
  if (request.parentUserId) {
    await notificationService.create({
      type: "child_leave",
      icon: "event_busy",
      title,
      message,
      targetRole: "parent",
      targetUserId: request.parentUserId,
      relatedId: request.id,
    });
  }
  const therapistUserIds = [...new Set([
    ...(request.therapistUserIds || []),
    ...request.impacts.map((impact) => impact.therapistUserId).filter(Boolean),
  ])];
  for (const therapistUserId of therapistUserIds) {
    await notificationService.create({
      type: "child_leave",
      icon: "event_busy",
      title,
      message,
      targetRole: "therapist",
      targetUserId: therapistUserId,
      relatedId: request.id,
    });
  }
}

async function findReplacement(session: any, request: ChildLeaveRequest) {
  const originalDate = normalizeDateKey(session.date);
  const originalDateValue = parseDateKey(originalDate);
  if (!originalDateValue) throw new Error("Tanggal sesi asal tidak valid.");
  const firstCandidate = addDays(maxDateKey(request.periodEndDate, request.endDate, todayDateKey()), 1);
  const originalWeekday = originalDateValue.getDay();

  for (let offset = 0; offset <= SEARCH_DAYS; offset += 1) {
    const candidateDate = addDays(firstCandidate, offset);
    const candidateValue = parseDateKey(candidateDate);
    if (!candidateValue || candidateValue.getDay() !== originalWeekday) continue;
    const availability = await evaluateSessionSlot({
      therapistId: session.therapistId,
      childId: session.childId,
      roomId: session.roomId,
      date: candidateDate,
      startTime: session.startTime,
      duration: session.duration,
    }, session.id);
    if (availability.status === "available") return { date: candidateDate, startTime: session.startTime };
  }

  throw new Error(`Tidak ditemukan slot dengan hari dan jam yang sama dalam ${SEARCH_DAYS} hari setelah periode.`);
}

async function moveImpact(requestId: string, originalSessionId: string) {
  const request = await childLeaveService.getById(requestId);
  if (!request) throw httpError(404, "Pengajuan cuti anak tidak ditemukan.");
  const impact = request.impacts.find((item) => item.originalSessionId === originalSessionId);
  if (!impact || !MOVABLE_IMPACT_STATUSES.has(impact.status) || !withinRange(impact.originalDate, request)) return;

  try {
    const session = await db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, originalSessionId),
    });
    if (!session || ["cancelled", "canceled", "active", "done", "completed"].includes(String(session.status || "").toLowerCase())) {
      await mutateImpact(requestId, originalSessionId, (item) => ({
        ...item,
        status: "not_applicable",
        lastError: "Sesi asal sudah tidak dapat dipindahkan.",
      }));
      return;
    }
    const replacement = await findReplacement(session, request);
    const result = await sessionService.cancelWithPolicy(originalSessionId, {
      policy: "replacement",
      cancelReason: `Cuti anak ${request.startDate} sampai ${request.endDate}.`,
      replacement: {
        ...replacement,
        note: `Sesi dipindahkan otomatis setelah periode karena cuti anak ${request.id}.`,
      },
    });
    if (!result?.replacement) throw new Error("Sesi pengganti tidak berhasil dibuat.");
    await mutateImpact(requestId, originalSessionId, (item) => ({
      ...item,
      status: "moved",
      replacementSessionId: result.replacement.id,
      replacementDate: normalizeDateKey(result.replacement.date),
      replacementStartTime: result.replacement.startTime,
      lastError: "",
    }));
  } catch (error) {
    await mutateImpact(requestId, originalSessionId, (item) => ({
      ...item,
      status: "move_failed",
      lastError: error instanceof Error ? error.message : "Pemindahan sesi gagal.",
    }));
  }
}

async function movePendingImpacts(requestId: string) {
  const request = await childLeaveService.getById(requestId);
  if (!request) return;
  for (const impact of request.impacts.filter((item) => MOVABLE_IMPACT_STATUSES.has(item.status) && withinRange(item.originalDate, request))) {
    await moveImpact(requestId, impact.originalSessionId);
  }
}

async function restoreImpact(requestId: string, impact: ChildLeaveImpact, note: string) {
  if (!impact.replacementSessionId) {
    await mutateImpact(requestId, impact.originalSessionId, (item) => ({
      ...item,
      status: "not_applicable",
      lastError: "Tidak ada sesi pengganti yang perlu dipulihkan.",
    }));
    return;
  }
  try {
    const result = await sessionService.restoreReplacement(impact.replacementSessionId, {
      originalDate: impact.originalDate,
      originalStartTime: impact.originalStartTime,
      originalTherapistId: impact.therapistId,
      originalRoomId: impact.roomId,
      originalDuration: impact.duration,
      originalTherapyPeriodId: impact.therapyPeriodId,
      originalFocus: impact.focus,
      note,
    });
    await mutateImpact(requestId, impact.originalSessionId, (item) => ({
      ...item,
      status: "restored",
      restoredSessionId: result.restored.id,
      lastError: "",
    }));
  } catch (error) {
    await mutateImpact(requestId, impact.originalSessionId, (item) => ({
      ...item,
      status: "restore_failed",
      lastError: error instanceof Error ? error.message : "Pemulihan jadwal asal gagal. Sesi pengganti tetap dipertahankan.",
    }));
  }
}

export const childLeaveService = {
  async getAll() {
    return sortRequests(await readRequests());
  },

  async getById(id: string) {
    return (await readRequests()).find((request) => request.id === id) || null;
  },

  async create(data: any, actorId?: string) {
    const childId = String(data?.childId || "").trim();
    const therapyPeriodId = String(data?.therapyPeriodId || "").trim();
    const reason = String(data?.reason || "").trim();
    if (!childId || !therapyPeriodId) throw httpError(400, "Anak dan periode terapi wajib dipilih.");
    if (!reason) throw httpError(400, "Alasan cuti wajib diisi.");
    const { startDate, endDate } = normalizeRange(data?.startDate, data?.endDate);
    if (startDate < todayDateKey()) throw httpError(400, "Tanggal mulai cuti tidak boleh berada di masa lalu.");

    const context = await getContext(childId, therapyPeriodId);
    assertRangeTouchesPeriod({ startDate, endDate }, context);
    const sessions = await findImpactedSessions(childId, therapyPeriodId, startDate, endDate);
    const now = new Date().toISOString();
    const request: ChildLeaveRequest = {
      id: generateId("CHLEAVE"),
      childId,
      childName: context.childName,
      parentId: context.parentId,
      parentUserId: context.parentUserId,
      parentName: context.parentName,
      parentPhone: context.parentPhone,
      therapyPeriodId,
      periodName: context.periodName,
      periodStartDate: context.periodStartDate,
      periodEndDate: context.periodEndDate,
      startDate,
      endDate,
      reason,
      status: "draft",
      therapistUserIds: context.therapistUserIds,
      impacts: sortImpacts(sessions.map(buildImpact)),
      revisionHistory: [],
      createdAt: now,
      updatedAt: now,
      createdBy: actorId,
    };

    await withWriteLock(async (tx) => {
      const requests = await readRequests(tx);
      const overlap = requests.find((item) => (
        item.childId === childId
        && ACTIVE_STATUSES.has(item.status)
        && rangesOverlap(startDate, endDate, item.startDate, item.endDate)
      ));
      if (overlap) throw httpError(409, `Sudah ada pengajuan cuti aktif yang bertumpuk untuk ${overlap.childName}.`);
      await writeRequests([request, ...requests], tx);
    });
    return request;
  },

  async confirm(id: string, data: any, actorId?: string) {
    const communication = normalizeCommunication(data?.communicationChannel, data?.communicationNote);
    await mutateRequest(id, (request, requests) => {
      if (request.status !== "draft") throw httpError(409, "Hanya draft cuti yang dapat dikonfirmasi.");
      const overlap = requests.find((item) => (
        item.id !== request.id
        && item.childId === request.childId
        && ["confirmed", "revised"].includes(item.status)
        && rangesOverlap(request.startDate, request.endDate, item.startDate, item.endDate)
      ));
      if (overlap) throw httpError(409, `Rentang cuti bertumpuk dengan cuti aktif ${overlap.id}.`);
      const now = new Date().toISOString();
      return {
        ...request,
        ...communication,
        status: "confirmed",
        confirmedAt: now,
        confirmedBy: actorId,
        revisionHistory: [...request.revisionHistory, {
          action: "confirmed",
          nextStartDate: request.startDate,
          nextEndDate: request.endDate,
          ...communication,
          actorId,
          createdAt: now,
        }],
      };
    });
    await movePendingImpacts(id);
    const result = await this.getById(id);
    if (result) {
      const moved = result.impacts.filter((impact) => impact.status === "moved").length;
      const failed = result.impacts.filter((impact) => impact.status === "move_failed").length;
      await notifyParticipants(
        result,
        "Cuti anak dikonfirmasi",
        `${result.childName} cuti ${result.startDate} sampai ${result.endDate}. ${moved} sesi dipindahkan setelah periode${failed ? ` dan ${failed} sesi perlu ditangani admin` : ""}.`,
      );
    }
    return result;
  },

  async revise(id: string, data: any, actorId?: string) {
    const communication = normalizeCommunication(data?.communicationChannel, data?.communicationNote);
    const strategy = data?.strategy === "keep_replacement" ? "keep_replacement" : "restore_original";
    const { startDate, endDate } = normalizeRange(data?.startDate, data?.endDate);
    const previous = await this.getById(id);
    if (!previous) throw httpError(404, "Pengajuan cuti anak tidak ditemukan.");
    if (!["confirmed", "revised"].includes(previous.status)) throw httpError(409, "Cuti ini belum dikonfirmasi atau sudah dibatalkan.");
    assertRangeTouchesPeriod({ startDate, endDate }, previous);

    const sessions = await findImpactedSessions(previous.childId, previous.therapyPeriodId, startDate, endDate);
    const existingIds = new Set(previous.impacts.map((impact) => impact.originalSessionId));
    const newImpacts = sessions.filter((session) => !existingIds.has(session.id)).map(buildImpact);
    const now = new Date().toISOString();
    await mutateRequest(id, (request, requests) => {
      const overlap = requests.find((item) => (
        item.id !== request.id
        && item.childId === request.childId
        && ACTIVE_STATUSES.has(item.status)
        && rangesOverlap(startDate, endDate, item.startDate, item.endDate)
      ));
      if (overlap) throw httpError(409, `Perubahan cuti bertumpuk dengan pengajuan ${overlap.id}.`);
      return {
        ...request,
        ...communication,
        startDate,
        endDate,
        status: "revised",
        impacts: sortImpacts([...request.impacts, ...newImpacts]),
        revisionHistory: [...request.revisionHistory, {
          action: "revised",
          previousStartDate: request.startDate,
          previousEndDate: request.endDate,
          nextStartDate: startDate,
          nextEndDate: endDate,
          strategy,
          ...communication,
          actorId,
          createdAt: now,
        }],
      };
    });

    const released = previous.impacts.filter((impact) => !withinRange(impact.originalDate, { startDate, endDate }));
    for (const impact of released) {
      if (MOVABLE_IMPACT_STATUSES.has(impact.status)) {
        await mutateImpact(id, impact.originalSessionId, (item) => ({ ...item, status: "not_applicable", lastError: "" }));
      } else if (RESTORABLE_IMPACT_STATUSES.has(impact.status)) {
        if (strategy === "restore_original") {
          await restoreImpact(id, impact, `Jadwal asal dipulihkan karena periode cuti ${previous.childName} diperpendek.`);
        } else {
          await mutateImpact(id, impact.originalSessionId, (item) => ({ ...item, status: "kept_replacement", lastError: "" }));
        }
      }
    }
    await movePendingImpacts(id);
    const result = await this.getById(id);
    if (result) {
      await notifyParticipants(
        result,
        "Cuti anak diperbarui",
        `${result.childName} kini cuti ${result.startDate} sampai ${result.endDate}. Jadwal dilepas diproses dengan opsi ${strategy === "restore_original" ? "pulihkan tanggal asal" : "pertahankan sesi pengganti"}.`,
      );
    }
    return result;
  },

  async cancel(id: string, data: any, actorId?: string) {
    const existing = await this.getById(id);
    if (!existing) throw httpError(404, "Pengajuan cuti anak tidak ditemukan.");
    const communication = existing.status === "draft"
      ? { communicationChannel: "", communicationNote: String(data?.communicationNote || "Draft dibatalkan sebelum konfirmasi.").trim() }
      : normalizeCommunication(data?.communicationChannel, data?.communicationNote);
    const now = new Date().toISOString();
    await mutateRequest(id, (request) => {
      if (request.status === "cancelled") throw httpError(409, "Cuti anak ini sudah dibatalkan.");
      return {
        ...request,
        ...communication,
        status: "cancelled",
        revisionHistory: [...request.revisionHistory, {
          action: "cancelled",
          previousStartDate: request.startDate,
          previousEndDate: request.endDate,
          communicationChannel: communication.communicationChannel || "other",
          communicationNote: communication.communicationNote,
          actorId,
          createdAt: now,
        }],
      };
    });

    if (existing.status !== "draft") {
      for (const impact of existing.impacts.filter((item) => RESTORABLE_IMPACT_STATUSES.has(item.status))) {
        await restoreImpact(id, impact, `Jadwal asal dipulihkan karena cuti ${existing.childName} dibatalkan.`);
      }
    }
    const result = await this.getById(id);
    if (result) {
      const failed = result.impacts.filter((impact) => impact.status === "restore_failed").length;
      await notifyParticipants(
        result,
        "Cuti anak dibatalkan",
        `${result.childName} batal cuti. Jadwal asal yang masih tersedia dipulihkan${failed ? `; ${failed} sesi tetap memakai jadwal pengganti karena tanggal asal sudah lewat atau bentrok` : ""}.`,
      );
    }
    return result;
  },

  async retryFailed(id: string) {
    const request = await this.getById(id);
    if (!request) throw httpError(404, "Pengajuan cuti anak tidak ditemukan.");
    if (!["confirmed", "revised"].includes(request.status)) throw httpError(409, "Cuti harus aktif untuk mencoba ulang pemindahan.");
    await movePendingImpacts(id);
    return this.getById(id);
  },
};
