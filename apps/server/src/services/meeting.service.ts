import { db } from "../db/index.js";
import { children, clinicSettings, parents, therapists } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { notificationService } from "./notification.service.js";

const MEETINGS_KEY = "parentMeetings";

type MeetingStatus =
  | "pending_admin_review"
  | "approved_by_admin"
  | "parent_confirmed"
  | "parent_declined"
  | "cancelled";

type ParentMeeting = {
  id: string;
  childId: string;
  parentId: string;
  therapistId: string;
  date: string;
  time: string;
  type: string;
  objective: string;
  notes?: string;
  status: MeetingStatus;
  requestedByRole: string;
  requestedByUserId: string;
  parentContactConfirmed?: boolean;
  communicationMethod?: string;
  reviewNote?: string;
  parentResponseNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  parentRespondedAt?: string;
  createdAt: string;
  updatedAt: string;
};

function parseMeetings(value?: string | null): ParentMeeting[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readMeetings() {
  const row = await db.query.clinicSettings.findFirst({ where: eq(clinicSettings.key, MEETINGS_KEY) });
  return parseMeetings(row?.value);
}

async function writeMeetings(meetings: ParentMeeting[]) {
  await db.insert(clinicSettings)
    .values({ key: MEETINGS_KEY, value: JSON.stringify(meetings), updatedAt: new Date() })
    .onConflictDoUpdate({ target: clinicSettings.key, set: { value: JSON.stringify(meetings), updatedAt: new Date() } });
}

async function enrich(meetings: ParentMeeting[]) {
  const [allChildren, allParents, allTherapists] = await Promise.all([
    db.query.children.findMany({ with: { parent: { with: { user: true } } } }),
    db.query.parents.findMany({ with: { user: true } }),
    db.query.therapists.findMany({ with: { user: true } }),
  ]);

  return meetings
    .map((meeting) => {
      const child = allChildren.find((item) => item.id === meeting.childId);
      const parent = allParents.find((item) => item.id === meeting.parentId);
      const therapist = allTherapists.find((item) => item.id === meeting.therapistId);
      return {
        ...meeting,
        child,
        parent,
        therapist,
        childName: child?.name || meeting.childId,
        parentName: parent?.user?.name || child?.parent?.user?.name || meeting.parentId,
        therapistName: therapist?.user?.name || meeting.therapistId,
      };
    })
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
}

async function notifyParent(parentId: string, title: string, message: string, relatedId: string) {
  const parent = await db.query.parents.findFirst({ where: eq(parents.id, parentId) });
  if (!parent?.userId) return;
  await notificationService.create({
    type: "parent_meeting",
    icon: "groups",
    title,
    message,
    targetRole: "parent",
    targetUserId: parent.userId,
    relatedId,
  });
}

async function notifyTherapist(therapistId: string, title: string, message: string, relatedId: string) {
  const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, therapistId) });
  if (!therapist?.userId) return;
  await notificationService.create({
    type: "parent_meeting",
    icon: "groups",
    title,
    message,
    targetRole: "therapist",
    targetUserId: therapist.userId,
    relatedId,
  });
}

export const meetingService = {
  async getAll() {
    return enrich(await readMeetings());
  },

  async getForTherapist(therapistId: string) {
    return enrich((await readMeetings()).filter((meeting) => meeting.therapistId === therapistId));
  },

  async getForParent(parentId: string) {
    return enrich((await readMeetings()).filter((meeting) => meeting.parentId === parentId && meeting.status !== "pending_admin_review"));
  },

  async getTherapistByUserId(userId: string) {
    return db.query.therapists.findFirst({ where: eq(therapists.userId, userId) });
  },

  async getParentByUserId(userId: string) {
    return db.query.parents.findFirst({ where: eq(parents.userId, userId) });
  },

  async create(data: any, requestedBy: { id: string; role: string }) {
    const child = await db.query.children.findFirst({ where: eq(children.id, data.childId), with: { parent: true } });
    if (!child) return null;

    const therapist = requestedBy.role === "therapist"
      ? await this.getTherapistByUserId(requestedBy.id)
      : await db.query.therapists.findFirst({ where: eq(therapists.id, data.therapistId || "") });
    if (!therapist) return null;

    const now = new Date().toISOString();
    const meeting: ParentMeeting = {
      id: `MTG-${Date.now().toString(36).toUpperCase()}`,
      childId: child.id,
      parentId: child.parentId,
      therapistId: therapist.id,
      date: data.date,
      time: data.time,
      type: data.type || "In-person",
      objective: data.objective || "Parent Review",
      notes: data.notes || "",
      status: requestedBy.role === "admin" ? "approved_by_admin" : "pending_admin_review",
      requestedByRole: requestedBy.role,
      requestedByUserId: requestedBy.id,
      parentContactConfirmed: requestedBy.role === "admin" ? !!data.parentContactConfirmed : false,
      communicationMethod: data.communicationMethod || "",
      reviewNote: requestedBy.role === "admin" ? data.reviewNote || "" : "",
      reviewedBy: requestedBy.role === "admin" ? requestedBy.id : undefined,
      reviewedAt: requestedBy.role === "admin" ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };

    const meetings = await readMeetings();
    meetings.push(meeting);
    await writeMeetings(meetings);

    if (meeting.status === "approved_by_admin") {
      await notifyParent(meeting.parentId, "Jadwal parent meeting menunggu persetujuan", `${meeting.objective} pada ${meeting.date} ${meeting.time}.`, meeting.id);
    }

    return (await enrich([meeting]))[0];
  },

  async adminReview(id: string, data: any, adminUserId: string) {
    const meetings = await readMeetings();
    const idx = meetings.findIndex((meeting) => meeting.id === id);
    if (idx < 0) return null;

    const status: MeetingStatus = data.status === "cancelled" || data.status === "parent_declined"
      ? "cancelled"
      : "approved_by_admin";
    const next = {
      ...meetings[idx],
      status,
      parentContactConfirmed: !!data.parentContactConfirmed,
      communicationMethod: data.communicationMethod || meetings[idx].communicationMethod || "",
      reviewNote: data.reviewNote || "",
      reviewedBy: adminUserId,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    meetings[idx] = next;
    await writeMeetings(meetings);

    if (status === "approved_by_admin") {
      await notifyParent(next.parentId, "Parent meeting disetujui admin", `${next.objective} dijadwalkan pada ${next.date} ${next.time}. Mohon konfirmasi di parent portal.`, next.id);
      await notifyTherapist(next.therapistId, "Parent meeting disetujui admin", `${next.objective} untuk ${next.date} ${next.time}.`, next.id);
    } else {
      await notifyTherapist(next.therapistId, "Parent meeting dibatalkan", data.reviewNote || "Permintaan meeting dibatalkan admin.", next.id);
    }

    return (await enrich([next]))[0];
  },

  async parentResponse(id: string, parentId: string, status: "parent_confirmed" | "parent_declined", note?: string) {
    const meetings = await readMeetings();
    const idx = meetings.findIndex((meeting) => meeting.id === id && meeting.parentId === parentId);
    if (idx < 0) return null;

    const next = {
      ...meetings[idx],
      status,
      parentResponseNote: note || "",
      parentRespondedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    meetings[idx] = next;
    await writeMeetings(meetings);
    await notifyTherapist(next.therapistId, status === "parent_confirmed" ? "Orang tua menyetujui parent meeting" : "Orang tua menolak parent meeting", `${next.objective} pada ${next.date} ${next.time}.`, next.id);
    return (await enrich([next]))[0];
  },

  async delete(id: string) {
    const meetings = await readMeetings();
    const next = meetings.filter((meeting) => meeting.id !== id);
    if (next.length === meetings.length) return null;
    await writeMeetings(next);
    return { deleted: true, id };
  },
};
