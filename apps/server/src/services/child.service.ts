import { db } from "../db/index.js";
import { children, clinicSettings, historicalSessionSummaries, migrationRecords, programs, reports, rescheduleRequests, sessionRatings, therapists, therapyPeriods, therapyPrograms, therapySessions } from "../db/schema.js";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { generateNITA } from "../utils/id-generators.js";
import { therapyPeriodService } from "./therapy-period.service.js";
import { evaluateSessionSlot } from "./scheduling-availability.service.js";
import { notificationService } from "./notification.service.js";
import { auditLogService } from "./audit-log.service.js";
import { httpError } from "../utils/http-error.js";

const CHILD_PHOTO_SETTINGS_KEY = "childPhotoUrls";
type DbClient = typeof db | any;
type AuditActor = { id?: string; role?: string; name?: string; email?: string } | null | undefined;

function parseChildPhotoMap(value?: string | null): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, url]) => typeof url === "string" && url.trim())
        .map(([id, url]) => [id, String(url).trim()])
    );
  } catch {
    return {};
  }
}

export async function getChildPhotoUrlMap() {
  const row = await db.query.clinicSettings.findFirst({
    where: eq(clinicSettings.key, CHILD_PHOTO_SETTINGS_KEY),
  });
  return parseChildPhotoMap(row?.value);
}

export function attachChildPhotoUrl<T extends { id?: string | null; nita?: string | null }>(child: T | null | undefined, photoMap: Record<string, string>) {
  if (!child) return child;
  const photoUrl = (child.id && photoMap[child.id]) || (child.nita && photoMap[child.nita]) || "";
  return { ...child, photoUrl };
}

function collectTherapistIdsFromChild(child: any) {
  const ids = new Set<string>();
  (Array.isArray(child?.sessions) ? child.sessions : []).forEach((session: any) => {
    if (typeof session?.therapistId === "string" && session.therapistId) ids.add(session.therapistId);
  });
  (Array.isArray(child?.therapyPeriods) ? child.therapyPeriods : []).forEach((period: any) => {
    (Array.isArray(period?.scheduleRules) ? period.scheduleRules : []).forEach((rule: any) => {
      if (typeof rule?.therapistId === "string" && rule.therapistId) ids.add(rule.therapistId);
    });
    (Array.isArray(period?.assistantTherapistIds) ? period.assistantTherapistIds : []).forEach((id: unknown) => {
      if (typeof id === "string" && id) ids.add(id);
    });
  });
  return [...ids];
}

async function getTherapistDisplayMap(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map<string, any>();
  const rows = await db.query.therapists.findMany({
    where: inArray(therapists.id, uniqueIds),
    with: { user: true },
  });
  return new Map(rows.map((therapist) => [therapist.id, {
    id: therapist.id,
    nit: therapist.nit,
    name: therapist.user?.name || therapist.nit || therapist.id,
    email: therapist.user?.email || "",
    phone: therapist.user?.phone || "",
    specialty: therapist.specialty || "Therapist",
    avatar: therapist.avatar || therapist.user?.image || "",
    userId: therapist.userId,
  }] as [string, any]));
}

async function enrichChildList<T extends { id?: string | null; nita?: string | null }>(list: T[]) {
  const photoMap = await getChildPhotoUrlMap();
  const therapistMap = await getTherapistDisplayMap(list.flatMap(collectTherapistIdsFromChild));
  return list.map((child) => formatChildRecord(attachChildPhotoUrl(child, photoMap), therapistMap));
}

function calculateAge(dob?: string | Date | null) {
  if (!dob) return "";
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age >= 0 ? `${age} tahun` : "";
}

function initials(name?: string | null) {
  return String(name || "A")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";
}

function normalizeTherapyProgram(enrollment: any) {
  const name = enrollment?.program?.name || enrollment?.type || "Program Terapi";
  return {
    ...enrollment,
    name,
    type: enrollment?.type || name,
    code: enrollment?.program?.code || "",
    target: enrollment?.program?.target || "",
    color: enrollment?.colorClass || "emerald",
    sessionsCompleted: Number(enrollment?.sessionsCompleted || 0),
    totalSessions: Number(enrollment?.totalSessions || 0),
  };
}

function normalizeTherapyPeriod(period: any) {
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
  return {
    ...period,
    programName,
    completedSessions,
    totalSessions,
    progress: totalSessions > 0 ? Math.min(100, Math.round((completedSessions / totalSessions) * 100)) : 0,
    sessionLabel: totalSessions > 0 ? `${completedSessions}/${totalSessions} sesi` : `${completedSessions} sesi selesai`,
    historicalOpeningBalance: {
      completedCount: historicalCompletedSessions,
      firstKnownDate: historicalSummaries[0]?.firstKnownDate || null,
      lastKnownDate: historicalSummaries[0]?.lastKnownDate || null,
      sourceNote: historicalSummaries[0]?.sourceNote || "",
    },
  };
}

function formatChildRecord(child: any, therapistLookup = new Map<string, any>()) {
  if (!child) return child;
  const composedName = `${child.firstName || ""} ${child.lastName || ""}`.trim();
  const name = composedName || child.name || "Anak";
  const childPrograms = Array.isArray(child.therapyPrograms)
    ? child.therapyPrograms.map(normalizeTherapyProgram)
    : Array.isArray(child.programs)
      ? child.programs
      : [];
  const childSessions = Array.isArray(child.sessions) ? child.sessions : [];
  const childPeriods = Array.isArray(child.therapyPeriods)
    ? child.therapyPeriods.map(normalizeTherapyPeriod).filter(Boolean)
    : [];
  const activePeriod = childPeriods.find((period: any) => ["active", "planned"].includes(period.status)) || childPeriods[0] || null;
  const activeSessions = childSessions.filter((session: any) => session.status !== "cancelled");
  const primarySession = activeSessions[0] || childSessions[0];
  const activePrimaryTherapistId = (Array.isArray(activePeriod?.scheduleRules) ? activePeriod.scheduleRules : [])
    .find((rule: any) => typeof rule?.therapistId === "string" && rule.therapistId)?.therapistId
    || primarySession?.therapistId
    || "";
  const activePrimaryLookup = activePrimaryTherapistId ? therapistLookup.get(activePrimaryTherapistId) : null;
  const primaryTherapist = activePrimaryLookup || primarySession?.therapist;
  const therapistName = primaryTherapist?.user?.name || primaryTherapist?.name || "";
  const assistantTherapistIds = Array.isArray(activePeriod?.assistantTherapistIds)
    ? activePeriod.assistantTherapistIds.filter((id: unknown): id is string => typeof id === "string" && !!id)
    : [];
  const assistantTherapists = assistantTherapistIds.map((id: string) => therapistLookup.get(id) || { id, name: id });
  const periodSessions = activePeriod
    ? childSessions.filter((session: any) => session.therapyPeriodId === activePeriod.id)
    : childSessions;
  const historicalCompletedSessions = activePeriod?.historicalOpeningBalance?.completedCount || 0;
  const donePeriodSessions = periodSessions.filter((session: any) => session.status === "done" || session.status === "completed").length;
  const completedSessions = activePeriod
    ? Math.max(Number(activePeriod.completedSessions || 0), historicalCompletedSessions + donePeriodSessions)
    : childSessions.filter((session: any) => session.status === "done" || session.status === "completed").length;
  const plannedSessions = activePeriod?.totalSessions
    || childPrograms.reduce((sum: number, program: any) => sum + Number(program.totalSessions || 0), 0)
    || childSessions.length;
  const progress = plannedSessions > 0 ? Math.min(100, Math.round((completedSessions / plannedSessions) * 100)) : 0;
  const sessionLabel = plannedSessions > 0 ? `${completedSessions}/${plannedSessions} sesi` : `${completedSessions} sesi selesai`;
  const photoUrl = child.photoUrl || "";

  return {
    ...child,
    name,
    age: calculateAge(child.dob),
    programs: childPrograms,
    periods: childPeriods,
    activePeriod,
    periodLabel: activePeriod ? `${activePeriod.name} - ${activePeriod.programName}` : "Belum ada periode",
    financialLabel: activePeriod?.totalPrice
      ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(activePeriod.totalPrice || 0))
      : "",
    program: childPrograms[0]?.name || "",
    therapistId: activePrimaryTherapistId,
    therapist: therapistName || "Belum ditugaskan",
    therapistInitials: initials(therapistName || "Terapis"),
    therapistAvatarType: primaryTherapist?.avatar ? "img" : "initials",
    therapistAvatar: primaryTherapist?.avatar || "",
    assistantTherapistIds,
    assistantTherapists,
    assignmentSummary: {
      primaryTherapistId: activePrimaryTherapistId,
      primaryTherapistName: therapistName || "",
      assistantTherapistIds,
      assistantTherapistNames: assistantTherapists.map((therapist: any) => therapist.name || therapist.id),
      activePeriodId: activePeriod?.id || "",
    },
    avatarType: photoUrl ? "img" : "initials",
    avatar: photoUrl,
    avatarInitials: initials(name),
    sessionLabel,
    progress,
    progressColor: progress >= 70 ? "emerald" : "primary",
    phase: activePeriod?.name || childPrograms[0]?.goal || childPrograms[0]?.name || "Program aktif",
  };
}

function pickChildValues(data: any) {
  const hasFirstName = Object.prototype.hasOwnProperty.call(data, "firstName") && typeof data.firstName === "string";
  const hasLastName = Object.prototype.hasOwnProperty.call(data, "lastName") && typeof data.lastName === "string";
  const nextFirstName = hasFirstName ? data.firstName.trim() : String(data.currentFirstName || "").trim();
  const nextLastName = hasLastName ? data.lastName.trim() : String(data.currentLastName || "").trim();

  if (hasFirstName && !nextFirstName) {
    throw httpError(400, "Nama depan wajib diisi.");
  }

  const values: Partial<typeof children.$inferInsert> = {
    ...(hasFirstName ? { firstName: nextFirstName } : {}),
    ...(hasLastName ? { lastName: nextLastName } : {}),
    ...(typeof data.dob === "string" ? { dob: data.dob || null } : {}),
    ...(typeof data.gender === "string" ? { gender: data.gender } : {}),
    ...(typeof data.school === "string" ? { school: data.school.trim() } : {}),
    ...(typeof data.diagnosis === "string" ? { diagnosis: data.diagnosis.trim() } : {}),
    ...(typeof data.status === "string" ? { status: data.status } : {}),
  };
  if (hasFirstName || hasLastName) {
    values.name = `${nextFirstName} ${nextLastName}`.trim();
  }
  return values;
}

async function upsertPrimaryProgram(childId: string, data: any) {
  const requestedName = typeof data.program === "string" ? data.program.trim() : "";
  const requestedProgramId = typeof data.programId === "string" ? data.programId : "";
  const firstProgram = Array.isArray(data.programs) ? data.programs[0] : null;
  const programName = requestedName || firstProgram?.name || "";
  const programId = requestedProgramId || firstProgram?.programId || "";
  if (!programName && !programId) return;

  const linkedProgram = programId
    ? await db.query.programs.findFirst({ where: eq(programs.id, programId) })
    : programName
      ? await db.query.programs.findFirst({ where: eq(programs.name, programName) })
      : null;
  const type = linkedProgram?.name || programName || firstProgram?.type || "Program Terapi";
  const existing = await db.query.therapyPrograms.findFirst({ where: eq(therapyPrograms.childId, childId) });

  if (existing) {
    await db.update(therapyPrograms)
      .set({
        programId: linkedProgram?.id || programId || existing.programId,
        type,
        goal: firstProgram?.goal || existing.goal,
      })
      .where(eq(therapyPrograms.id, existing.id));
    return;
  }

  await db.insert(therapyPrograms).values({
    childId,
    programId: linkedProgram?.id || programId || null,
    type,
    totalSessions: Number(firstProgram?.totalSessions || 0),
    goal: firstProgram?.goal || "",
    colorClass: firstProgram?.color || firstProgram?.colorClass || "emerald",
  });
}

async function updateUpcomingTherapist(childId: string, therapistId?: string) {
  if (!therapistId) return;
  const today = new Date().toISOString().split("T")[0];
  await db.update(therapySessions)
    .set({ therapistId })
    .where(and(
      eq(therapySessions.childId, childId),
      gte(therapySessions.date, today),
      sql`${therapySessions.status} != 'done'`
    ));
}

function normalizeEffectiveDate(value: unknown) {
  const raw = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
  return raw || new Date().toISOString().slice(0, 10);
}

function isOpenTransferSession(session: any, effectiveDate: string, fromTherapistId: string) {
  const status = String(session?.status || "").toLowerCase();
  return session?.therapistId === fromTherapistId
    && typeof session?.date === "string"
    && session.date >= effectiveDate
    && !["done", "completed", "cancelled", "canceled", "active"].includes(status);
}

function replacePrimaryInRules(rules: unknown, fromTherapistId: string, toTherapistId: string) {
  if (!Array.isArray(rules)) return { rules: [], changed: false };
  let changed = false;
  const next = rules.map((rule: any) => {
    if (rule?.therapistId === fromTherapistId) {
      changed = true;
      return { ...rule, therapistId: toTherapistId };
    }
    return rule;
  });
  return { rules: next, changed };
}

function replaceAssistantId(ids: unknown, fromTherapistId: string, toTherapistId: string) {
  if (!Array.isArray(ids)) return { ids: [], changed: false };
  let changed = false;
  const next = ids.map((id) => {
    if (id === fromTherapistId) {
      changed = true;
      return toTherapistId;
    }
    return id;
  });
  return { ids: Array.from(new Set(next.filter((id): id is string => typeof id === "string" && !!id))), changed };
}

async function notifyTherapistAssignmentChange(
  data: {
    childName: string;
    childId: string;
    fromTherapist?: any;
    toTherapist?: any;
    coTherapistIds: string[];
    roleType: "primary" | "assistant";
    effectiveDate: string;
    reason: string;
    relatedId: string;
  },
  client: DbClient,
) {
  const roleLabel = data.roleType === "primary" ? "terapis utama" : "terapis pendamping";
  const fromName = data.fromTherapist?.user?.name || data.fromTherapist?.nit || data.fromTherapist?.id || data.fromTherapist?.name || "terapis sebelumnya";
  const toName = data.toTherapist?.user?.name || data.toTherapist?.nit || data.toTherapist?.id || data.toTherapist?.name || "terapis pengganti";

  if (data.fromTherapist?.userId) {
    await notificationService.create({
      type: "critical_assignment_change",
      icon: "rule",
      title: "Konfirmasi perubahan case",
      message: `Admin mengganti ${roleLabel} ${data.childName} dari ${fromName} ke ${toName} mulai ${data.effectiveDate}. Alasan: ${data.reason || "critical decision admin"}. Riwayat laporan lama tetap atas nama terapis yang membuatnya.`,
      targetRole: "therapist",
      targetUserId: data.fromTherapist.userId,
      relatedId: data.relatedId,
    }, client);
  }

  if (data.toTherapist?.userId) {
    await notificationService.create({
      type: "critical_assignment_change",
      icon: "assignment_ind",
      title: "Case terapi baru ditugaskan",
      message: `Anda ditugaskan sebagai ${roleLabel} untuk ${data.childName} mulai ${data.effectiveDate}.`,
      targetRole: "therapist",
      targetUserId: data.toTherapist.userId,
      relatedId: data.relatedId,
    }, client);
  }

  const coTherapists = data.coTherapistIds.length
    ? await client.query.therapists.findMany({ where: inArray(therapists.id, data.coTherapistIds), with: { user: true } })
    : [];
  for (const therapist of coTherapists) {
    if (!therapist.userId || therapist.userId === data.fromTherapist?.userId || therapist.userId === data.toTherapist?.userId) continue;
    await notificationService.create({
      type: "critical_assignment_change",
      icon: "groups",
      title: "Perubahan tim case terapi",
      message: `${roleLabel} ${data.childName} berubah dari ${fromName} ke ${toName} mulai ${data.effectiveDate}.`,
      targetRole: "therapist",
      targetUserId: therapist.userId,
      relatedId: data.relatedId,
    }, client);
  }
}

export const childService = {
  async getAll() {
    const rows = await db.query.children.findMany({
      with: {
        parent: { with: { user: true } },
        therapyPrograms: { with: { program: true } },
        therapyPeriods: { with: { program: true, therapyProgram: true, sessions: true, historicalSummaries: true } },
        sessions: { with: { therapist: { with: { user: true } } } },
      },
    });
    return enrichChildList(rows);
  },

  async getById(id: string) {
    const child = await db.query.children.findFirst({
      where: eq(children.id, id),
      with: {
        parent: { with: { user: true } },
        therapyPrograms: { with: { program: true } },
        therapyPeriods: { with: { program: true, therapyProgram: true, sessions: true, historicalSummaries: true } },
        sessions: { with: { therapist: { with: { user: true } }, room: true } },
      },
    });
    const photoMap = await getChildPhotoUrlMap();
    const therapistMap = await getTherapistDisplayMap(collectTherapistIdsFromChild(child));
    return formatChildRecord(attachChildPhotoUrl(child, photoMap), therapistMap);
  },

  async getByParent(parentId: string) {
    const rows = await db.query.children.findMany({
      where: eq(children.parentId, parentId),
      with: {
        therapyPrograms: { with: { program: true } },
        therapyPeriods: { with: { program: true, therapyProgram: true, sessions: true, historicalSummaries: true } },
        sessions: { with: { therapist: { with: { user: true } } } },
      },
    });
    return enrichChildList(rows);
  },

  async create(parentId: string, data: {
    firstName: string; lastName?: string; dob?: string;
    gender?: string; school?: string; diagnosis?: string;
    therapyProgramsList?: Array<{
      type: string; totalSessions: number; goal?: string; icon?: string; colorClass?: string; colorHex?: string; programId?: string;
      startDate?: string; endDate?: string; pricePerSession?: number; pricePerMonth?: number; totalPrice?: number; billingMode?: string;
      scheduleRules?: Array<Record<string, unknown>>; assistantTherapistIds?: string[]; generateSessions?: boolean; createInitialPeriod?: boolean;
    }>;
  }) {
    const lastSeq = await this.getLastSequence();
    const nita = generateNITA(lastSeq + 1);
    const firstName = data.firstName.trim();
    const lastName = data.lastName?.trim() || "";

    const [child] = await db.insert(children).values({
      id: nita,
      nita,
      parentId,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      dob: data.dob,
      gender: data.gender,
      school: data.school,
      diagnosis: data.diagnosis,
    }).returning();

    // Insert therapy programs if provided
    if (data.therapyProgramsList && data.therapyProgramsList.length > 0) {
      const insertedPrograms = await db.insert(therapyPrograms).values(
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
      ).returning();

      for (let i = 0; i < insertedPrograms.length; i += 1) {
        const source = data.therapyProgramsList[i];
        if (source?.createInitialPeriod === false) continue;
        await therapyPeriodService.create({
          childId: nita,
          therapyProgramId: insertedPrograms[i].id,
          programId: insertedPrograms[i].programId,
          type: insertedPrograms[i].type,
          totalSessions: source?.totalSessions || insertedPrograms[i].totalSessions,
          goal: source?.goal || insertedPrograms[i].goal || "",
          startDate: source?.startDate,
          endDate: source?.endDate,
          pricePerSession: source?.pricePerSession,
          pricePerMonth: source?.pricePerMonth,
          totalPrice: source?.totalPrice,
          billingMode: source?.billingMode,
          scheduleRules: source?.scheduleRules,
          assistantTherapistIds: source?.assistantTherapistIds,
          generateSessions: source?.generateSessions,
        });
      }
    }

    return child;
  },

  async update(id: string, updates: any) {
    const existing = await db.query.children.findFirst({ where: eq(children.id, id) });
    if (!existing) return null;

    const values = pickChildValues({
      ...updates,
      currentFirstName: existing.firstName,
      currentLastName: existing.lastName,
    });
    if (Object.keys(values).length > 0) {
      await db.update(children)
        .set(values)
        .where(eq(children.id, id));
    }
    await upsertPrimaryProgram(id, updates);
    return this.getById(id);
  },

  async reassignTherapist(id: string, data: {
    roleType?: "primary" | "assistant";
    fromTherapistId?: string;
    toTherapistId?: string;
    effectiveDate?: string;
    reason?: string;
    transferFutureSessions?: boolean;
    periodId?: string;
  }, actor?: AuditActor) {
    const child = await db.query.children.findFirst({
      where: eq(children.id, id),
      with: {
        parent: { with: { user: true } },
        therapyPeriods: { with: { program: true, therapyProgram: true, sessions: true, historicalSummaries: true } },
        sessions: true,
      },
    });
    if (!child) return null;

    const roleType = data.roleType === "assistant" ? "assistant" : "primary";
    const fromTherapistId = String(data.fromTherapistId || "").trim();
    const toTherapistId = String(data.toTherapistId || "").trim();
    if (!fromTherapistId || !toTherapistId) throw httpError(400, "Terapis lama dan terapis pengganti wajib dipilih.");
    if (fromTherapistId === toTherapistId) throw httpError(400, "Terapis pengganti tidak boleh sama dengan terapis sebelumnya.");
    const reason = String(data.reason || "").trim();
    if (reason.length < 8) throw httpError(400, "Alasan critical decision wajib diisi dengan jelas.");

    const [fromTherapist, toTherapist] = await Promise.all([
      db.query.therapists.findFirst({ where: eq(therapists.id, fromTherapistId), with: { user: true } }),
      db.query.therapists.findFirst({ where: eq(therapists.id, toTherapistId), with: { user: true } }),
    ]);
    if (!fromTherapist) throw httpError(404, "Terapis sebelumnya tidak ditemukan.");
    if (!toTherapist) throw httpError(404, "Terapis pengganti tidak ditemukan.");
    if (toTherapist.user?.status && toTherapist.user.status !== "active") {
      throw httpError(409, "Terapis pengganti tidak aktif.");
    }

    const periods = (Array.isArray(child.therapyPeriods) ? child.therapyPeriods : []).filter((period: any) => (
      data.periodId
        ? period.id === data.periodId
        : ["active", "planned"].includes(String(period.status || "").toLowerCase())
    ));
    if (periods.length === 0) throw httpError(404, "Periode aktif/planned untuk anak ini tidak ditemukan.");

    const periodUpdates: Array<{ id: string; scheduleRules?: any[]; assistantTherapistIds?: string[] }> = [];
    const coTherapistIds = new Set<string>();
    for (const period of periods) {
      const primaryIds = (Array.isArray(period.scheduleRules) ? period.scheduleRules : [])
        .map((rule: any) => rule?.therapistId)
        .filter((therapistId: unknown): therapistId is string => typeof therapistId === "string" && !!therapistId);
      primaryIds.forEach((therapistId: string) => coTherapistIds.add(therapistId));
      (Array.isArray(period.assistantTherapistIds) ? period.assistantTherapistIds : []).forEach((therapistId: unknown) => {
        if (typeof therapistId === "string" && therapistId) coTherapistIds.add(therapistId);
      });

      if (roleType === "primary") {
        const replaced = replacePrimaryInRules(period.scheduleRules, fromTherapistId, toTherapistId);
        if (replaced.changed) periodUpdates.push({ id: period.id, scheduleRules: replaced.rules });
      } else {
        const replaced = replaceAssistantId(period.assistantTherapistIds, fromTherapistId, toTherapistId);
        if (replaced.changed) periodUpdates.push({ id: period.id, assistantTherapistIds: replaced.ids });
      }
    }
    if (periodUpdates.length === 0) {
      throw httpError(409, "Terapis sebelumnya tidak ditemukan pada periode aktif/planned anak ini.");
    }

    const effectiveDate = normalizeEffectiveDate(data.effectiveDate);
    const transferFutureSessions = data.transferFutureSessions !== false && roleType === "primary";
    const sessionsToTransfer = transferFutureSessions
      ? (Array.isArray(child.sessions) ? child.sessions : []).filter((session: any) => isOpenTransferSession(session, effectiveDate, fromTherapistId))
      : [];

    for (const session of sessionsToTransfer) {
      const availability = await evaluateSessionSlot({
        therapistId: toTherapistId,
        childId: session.childId,
        roomId: session.roomId || null,
        date: session.date,
        startTime: session.startTime,
        duration: session.duration || undefined,
      }, session.id);
      if (availability.status !== "available") {
        throw httpError(409, `${session.date} ${session.startTime}: ${availability.reason || "Terapis pengganti tidak tersedia."}`, availability);
      }
    }

    const relatedId = `CHILD-ASSIGN-${id}-${Date.now().toString(36).toUpperCase()}`;
    await db.transaction(async (tx) => {
      for (const update of periodUpdates) {
        await tx.update(therapyPeriods)
          .set({
            ...(update.scheduleRules ? { scheduleRules: update.scheduleRules } : {}),
            ...(update.assistantTherapistIds ? { assistantTherapistIds: update.assistantTherapistIds } : {}),
            updatedAt: new Date(),
          })
          .where(eq(therapyPeriods.id, update.id));
      }

      for (const session of sessionsToTransfer) {
        const existingNotes = String(session.notes || "").trim();
        const decisionLine = `[${new Date().toISOString()}] Critical decision: terapis dialihkan dari ${fromTherapistId} ke ${toTherapistId}. ${reason}`;
        await tx.update(therapySessions)
          .set({
            therapistId: toTherapistId,
            status: "upcoming",
            notes: existingNotes ? `${existingNotes}\n${decisionLine}` : decisionLine,
            cancelReason: `Case dialihkan dari ${fromTherapist.user?.name || fromTherapistId} ke ${toTherapist.user?.name || toTherapistId}.`,
          })
          .where(eq(therapySessions.id, session.id));
      }

      await notifyTherapistAssignmentChange({
        childName: child.name,
        childId: child.id,
        fromTherapist,
        toTherapist,
        coTherapistIds: [...coTherapistIds].filter((therapistId) => therapistId !== fromTherapistId && therapistId !== toTherapistId),
        roleType,
        effectiveDate,
        reason,
        relatedId,
      }, tx);

      if (child.parent?.userId) {
        await notificationService.create({
          type: "critical_assignment_change",
          icon: "manage_accounts",
          title: "Perubahan tim terapi anak",
          message: `Tim terapi ${child.name} diperbarui mulai ${effectiveDate}. Riwayat laporan dan sesi sebelumnya tetap tersimpan sesuai terapis yang menangani.`,
          targetRole: "parent",
          targetUserId: child.parent.userId,
          relatedId,
        }, tx);
      }

      await notificationService.create({
        type: "critical_assignment_change",
        icon: "rule",
        title: "Critical decision tersimpan",
        message: `${actor?.name || actor?.email || "Admin"} mengganti ${roleType === "primary" ? "terapis utama" : "terapis pendamping"} ${child.name}.`,
        targetRole: "admin",
        relatedId,
      }, tx);

      await auditLogService.create({
        actor,
        action: "child.therapist_reassignment.critical",
        entityType: "child",
        entityId: child.id,
        summary: `Critical decision penggantian ${roleType === "primary" ? "terapis utama" : "terapis pendamping"} untuk ${child.name}`,
        metadata: {
          roleType,
          fromTherapistId,
          toTherapistId,
          effectiveDate,
          reason,
          periodIds: periodUpdates.map((period) => period.id),
          transferredSessionIds: sessionsToTransfer.map((session: any) => session.id),
          historicalReportsPreserved: true,
        },
      }, tx);
    });

    const updatedChild = await this.getById(id);
    return {
      child: updatedChild,
      summary: {
        roleType,
        fromTherapistId,
        toTherapistId,
        effectiveDate,
        updatedPeriods: periodUpdates.length,
        transferredSessions: sessionsToTransfer.length,
        historicalReportsPreserved: true,
      },
    };
  },

  async updatePhoto(id: string, photoUrl: string) {
    const child = await db.query.children.findFirst({ where: eq(children.id, id) });
    if (!child) return null;

    const photoMap = await getChildPhotoUrlMap();
    photoMap[child.id] = photoUrl.trim();
    if (child.nita) photoMap[child.nita] = photoUrl.trim();

    await db.insert(clinicSettings)
      .values({ key: CHILD_PHOTO_SETTINGS_KEY, value: JSON.stringify(photoMap), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: clinicSettings.key,
        set: { value: JSON.stringify(photoMap), updatedAt: new Date() },
      });

    return this.getById(id);
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

    await db.delete(historicalSessionSummaries).where(eq(historicalSessionSummaries.childId, id));
    await db.update(migrationRecords).set({ childId: null, therapyPeriodId: null }).where(eq(migrationRecords.childId, id));
    await db.delete(therapyPeriods).where(eq(therapyPeriods.childId, id));
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
