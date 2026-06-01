import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { children, parents, therapists, therapySessions } from "../db/schema.js";
import { normalizeDateKey, todayDateKey } from "../utils/date-key.js";
import { evaluateSessionSlot } from "./scheduling-availability.service.js";
import { notificationService } from "./notification.service.js";

function getSessionDateKey(session: { date?: string | Date | null }) {
  return normalizeDateKey(session.date);
}

function formatSessionTime(session: { date?: string | Date | null; startTime?: string | null }) {
  return `${getSessionDateKey(session)} ${session.startTime || ""}`.trim();
}

async function notifyImpactedSession(
  session: typeof therapySessions.$inferSelect,
  reason: string,
) {
  const therapist = await db.query.therapists.findFirst({
    where: eq(therapists.id, session.therapistId),
    with: { user: true },
  });
  const child = await db.query.children.findFirst({ where: eq(children.id, session.childId) });
  const parent = child?.parentId
    ? await db.query.parents.findFirst({ where: eq(parents.id, child.parentId) })
    : null;
  const childName = child?.name || session.childId;
  const therapistName = therapist?.user?.name || therapist?.nit || session.therapistId;
  const when = formatSessionTime(session);

  await notificationService.create({
    type: "schedule_conflict",
    icon: "event_busy",
    title: "Jadwal perlu reschedule",
    message: `${childName} pada ${when} bentrok karena ${reason}. Admin perlu mengatur ulang jadwal.`,
    targetRole: "admin",
    relatedId: session.id,
  });

  if (therapist?.userId) {
    await notificationService.create({
      type: "schedule_conflict",
      icon: "event_busy",
      title: "Ada sesi di luar jadwal kerja",
      message: `Sesi ${childName} pada ${when} bentrok karena ${reason}. Mohon tunggu update jadwal dari admin.`,
      targetRole: "therapist",
      targetUserId: therapist.userId,
      relatedId: session.id,
    });
  }

  if (parent?.userId) {
    await notificationService.create({
      type: "schedule_change",
      icon: "event_repeat",
      title: "Jadwal terapi perlu dikonfirmasi ulang",
      message: `Sesi ${childName} dengan ${therapistName} pada ${when} perlu reschedule karena ${reason}. Admin center akan menghubungi untuk jadwal pengganti.`,
      targetRole: "parent",
      targetUserId: parent.userId,
      relatedId: session.id,
    });
  }
}

export async function notifyTherapistScheduleConflicts(therapistId: string) {
  const today = todayDateKey();
  const sessions = await db.query.therapySessions.findMany({
    where: sql`${therapySessions.therapistId} = ${therapistId}
      and ${therapySessions.date} >= ${today}
      and ${therapySessions.status} not in ('cancelled', 'done')`,
  });

  for (const session of sessions) {
    const availability = await evaluateSessionSlot({
      therapistId: session.therapistId,
      childId: session.childId,
      roomId: session.roomId,
      date: getSessionDateKey(session),
      startTime: session.startTime,
      duration: session.duration,
    }, session.id);

    if (availability.status !== "conflict" || availability.kind !== "therapist") continue;
    await notifyImpactedSession(session, availability.reason || "jadwal terapis sedang off");
  }
}

export async function notifyCenterClosureSessionConflicts(startDate: string, endDate: string, reason: string) {
  const sessions = await db.query.therapySessions.findMany({
    where: sql`${therapySessions.date} >= ${startDate}
      and ${therapySessions.date} <= ${endDate}
      and ${therapySessions.status} not in ('cancelled', 'done')`,
  });

  for (const session of sessions) {
    await notifyImpactedSession(session, reason);
  }
}
