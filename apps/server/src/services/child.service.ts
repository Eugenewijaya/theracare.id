import { db } from "../db/index.js";
import { children, clinicSettings, programs, reports, rescheduleRequests, sessionRatings, therapyPrograms, therapySessions } from "../db/schema.js";
import { and, eq, gte, sql } from "drizzle-orm";
import { generateNITA } from "../utils/id-generators.js";

const CHILD_PHOTO_SETTINGS_KEY = "childPhotoUrls";

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

async function enrichChildList<T extends { id?: string | null; nita?: string | null }>(list: T[]) {
  const photoMap = await getChildPhotoUrlMap();
  return list.map((child) => formatChildRecord(attachChildPhotoUrl(child, photoMap)));
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

function formatChildRecord(child: any) {
  if (!child) return child;
  const name = child.name || `${child.firstName || ""} ${child.lastName || ""}`.trim() || "Anak";
  const childPrograms = Array.isArray(child.therapyPrograms)
    ? child.therapyPrograms.map(normalizeTherapyProgram)
    : Array.isArray(child.programs)
      ? child.programs
      : [];
  const childSessions = Array.isArray(child.sessions) ? child.sessions : [];
  const activeSessions = childSessions.filter((session: any) => session.status !== "cancelled");
  const primarySession = activeSessions[0] || childSessions[0];
  const primaryTherapist = primarySession?.therapist;
  const therapistName = primaryTherapist?.user?.name || primaryTherapist?.name || "";
  const completedSessions = childSessions.filter((session: any) => session.status === "done" || session.status === "completed").length;
  const plannedSessions = childPrograms.reduce((sum: number, program: any) => sum + Number(program.totalSessions || 0), 0) || childSessions.length;
  const progress = plannedSessions > 0 ? Math.min(100, Math.round((completedSessions / plannedSessions) * 100)) : 0;
  const sessionLabel = plannedSessions > 0 ? `${completedSessions}/${plannedSessions} sesi` : `${completedSessions} sesi selesai`;
  const photoUrl = child.photoUrl || "";

  return {
    ...child,
    name,
    age: calculateAge(child.dob),
    programs: childPrograms,
    program: childPrograms[0]?.name || "",
    therapistId: primarySession?.therapistId || "",
    therapist: therapistName || "Belum ditugaskan",
    therapistInitials: initials(therapistName || "Terapis"),
    therapistAvatarType: primaryTherapist?.avatar ? "img" : "initials",
    therapistAvatar: primaryTherapist?.avatar || "",
    avatarType: photoUrl ? "img" : "initials",
    avatar: photoUrl,
    avatarInitials: initials(name),
    sessionLabel,
    progress,
    progressColor: progress >= 70 ? "emerald" : "primary",
    phase: childPrograms[0]?.goal || childPrograms[0]?.name || "Program aktif",
  };
}

function pickChildValues(data: any) {
  const values: Partial<typeof children.$inferInsert> = {
    ...(typeof data.firstName === "string" ? { firstName: data.firstName.trim() } : {}),
    ...(typeof data.lastName === "string" ? { lastName: data.lastName.trim() } : {}),
    ...(typeof data.dob === "string" ? { dob: data.dob || null } : {}),
    ...(typeof data.gender === "string" ? { gender: data.gender } : {}),
    ...(typeof data.school === "string" ? { school: data.school.trim() } : {}),
    ...(typeof data.diagnosis === "string" ? { diagnosis: data.diagnosis.trim() } : {}),
    ...(typeof data.status === "string" ? { status: data.status } : {}),
  };
  if (values.firstName || values.lastName) {
    values.name = `${values.firstName || data.currentFirstName || ""} ${values.lastName || data.currentLastName || ""}`.trim();
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

export const childService = {
  async getAll() {
    const rows = await db.query.children.findMany({
      with: {
        parent: { with: { user: true } },
        therapyPrograms: { with: { program: true } },
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
        sessions: { with: { therapist: { with: { user: true } }, room: true } },
      },
    });
    const photoMap = await getChildPhotoUrlMap();
    return formatChildRecord(attachChildPhotoUrl(child, photoMap));
  },

  async getByParent(parentId: string) {
    const rows = await db.query.children.findMany({
      where: eq(children.parentId, parentId),
      with: {
        therapyPrograms: { with: { program: true } },
        sessions: { with: { therapist: { with: { user: true } } } },
      },
    });
    return enrichChildList(rows);
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
    await updateUpcomingTherapist(id, updates.therapistId);
    return this.getById(id);
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
