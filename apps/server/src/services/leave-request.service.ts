import { db } from "../db/index.js";
import { clinicSettings, therapists, therapySessions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { notificationService } from "./notification.service.js";

const LEAVE_REQUESTS_KEY = "leaveRequests";

type LeaveRequestStatus = "pending" | "approved" | "rejected";

type LeaveRequest = {
  id: string;
  therapistId: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveRequestStatus;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};

function httpError(message: string, statusCode: number, data?: any) {
  const error = new Error(message) as Error & { statusCode?: number; data?: any };
  error.statusCode = statusCode;
  error.data = data;
  return error;
}

function parseLeaveRequests(value?: string | null): LeaveRequest[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readLeaveRequests() {
  const row = await db.query.clinicSettings.findFirst({ where: eq(clinicSettings.key, LEAVE_REQUESTS_KEY) });
  return parseLeaveRequests(row?.value);
}

async function writeLeaveRequests(requests: LeaveRequest[]) {
  await db.insert(clinicSettings)
    .values({ key: LEAVE_REQUESTS_KEY, value: JSON.stringify(requests), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: clinicSettings.key,
      set: { value: JSON.stringify(requests), updatedAt: new Date() },
    });
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}

async function enrich(requests: LeaveRequest[]) {
  const allTherapists = await db.query.therapists.findMany({ with: { user: true } });
  return requests
    .map((request) => {
      const therapist = allTherapists.find((item) => item.id === request.therapistId);
      return {
        ...request,
        therapist,
        therapistName: therapist?.user?.name || request.therapistId,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function notifyTherapist(therapistId: string, title: string, message: string, relatedId: string) {
  const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, therapistId) });
  if (!therapist?.userId) return;
  await notificationService.create({
    type: "leave_request",
    icon: "event_busy",
    title,
    message,
    targetRole: "therapist",
    targetUserId: therapist.userId,
    relatedId,
  });
}

export const leaveRequestService = {
  async getAll() {
    return enrich(await readLeaveRequests());
  },

  async getForTherapist(therapistId: string) {
    return enrich((await readLeaveRequests()).filter((request) => request.therapistId === therapistId));
  },

  async getTherapistByUserId(userId: string) {
    return db.query.therapists.findFirst({ where: eq(therapists.userId, userId) });
  },

  async create(data: any, therapistId: string) {
    const startDate = String(data.startDate || data.dateFrom || "").trim();
    const endDate = String(data.endDate || data.dateTo || startDate).trim();
    const reason = String(data.reason || "").trim();
    const type = String(data.type || "leave").trim();
    if (!startDate || !endDate || !reason) {
      throw httpError("Tanggal mulai, tanggal selesai, dan alasan cuti wajib diisi.", 400);
    }
    if (endDate < startDate) {
      throw httpError("Tanggal selesai cuti tidak boleh sebelum tanggal mulai.", 400);
    }

    const requests = await readLeaveRequests();
    const overlap = requests.find((request) => (
      request.therapistId === therapistId
      && request.status !== "rejected"
      && rangesOverlap(startDate, endDate, request.startDate, request.endDate)
    ));
    if (overlap) {
      throw httpError("Terapis sudah memiliki pengajuan cuti pada rentang tanggal tersebut.", 409, { conflict: overlap });
    }

    const now = new Date().toISOString();
    const request: LeaveRequest = {
      id: `LR-${Date.now().toString(36).toUpperCase()}`,
      therapistId,
      type,
      startDate,
      endDate,
      reason,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    requests.push(request);
    await writeLeaveRequests(requests);
    await notificationService.create({
      type: "leave_request",
      icon: "event_busy",
      title: "Pengajuan cuti terapis",
      message: `Terapis ${therapistId} mengajukan cuti pada ${startDate} sampai ${endDate}.`,
      targetRole: "admin",
      relatedId: request.id,
    });

    return (await enrich([request]))[0];
  },

  async updateStatus(id: string, status: LeaveRequestStatus, reviewNote: string | undefined, adminUserId: string) {
    if (!["approved", "rejected", "pending"].includes(status)) {
      throw httpError("Status cuti tidak valid.", 400);
    }

    const requests = await readLeaveRequests();
    const idx = requests.findIndex((request) => request.id === id);
    if (idx < 0) return null;

    const now = new Date().toISOString();
    const next: LeaveRequest = {
      ...requests[idx],
      status,
      reviewNote: reviewNote || "",
      reviewedBy: adminUserId,
      reviewedAt: now,
      updatedAt: now,
    };
    requests[idx] = next;
    await writeLeaveRequests(requests);

    if (status === "approved") {
      const sessions = await db.query.therapySessions.findMany({
        where: eq(therapySessions.therapistId, next.therapistId),
      });
      const affectedSessions = sessions.filter((session) => (
        session.date >= next.startDate
        && session.date <= next.endDate
        && !["cancelled", "done"].includes(session.status)
      ));
      for (const session of affectedSessions) {
        await db.update(therapySessions)
          .set({ status: "cancelled", cancelReason: `Terapis cuti: ${next.reason}` })
          .where(eq(therapySessions.id, session.id));
      }
    }

    await notifyTherapist(
      next.therapistId,
      status === "approved" ? "Cuti disetujui admin" : status === "rejected" ? "Cuti ditolak admin" : "Status cuti diperbarui",
      reviewNote || `Pengajuan cuti ${next.startDate} sampai ${next.endDate} berstatus ${status}.`,
      next.id
    );

    return (await enrich([next]))[0];
  },
};
