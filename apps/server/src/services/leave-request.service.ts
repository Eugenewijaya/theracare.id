import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicSettings } from "../db/schema.js";
import { generateId } from "../utils/id-generators.js";
import { notificationService } from "./notification.service.js";

const LEAVE_REQUESTS_KEY = "therapistLeaveRequests";
const VALID_TYPES = new Set(["cuti", "sakit", "unpaid_leave"]);
const VALID_STATUSES = new Set(["pending", "approved", "rejected"]);

type LeaveRequestStatus = "pending" | "approved" | "rejected";

type TherapistLeaveRequest = {
  id: string;
  therapistId: string;
  therapistUserId?: string;
  therapistName: string;
  therapistNit?: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveRequestStatus;
  reviewNote?: string;
  reviewedAt?: string;
  wasApproved?: boolean;
  postApprovalChangeCount?: number;
  history?: Array<{ status: LeaveRequestStatus; note?: string; createdAt: string }>;
  createdAt: string;
};

function parseRequests(value?: string | null): TherapistLeaveRequest[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readRequests() {
  const row = await db.query.clinicSettings.findFirst({
    where: eq(clinicSettings.key, LEAVE_REQUESTS_KEY),
  });
  return parseRequests(row?.value);
}

async function writeRequests(requests: TherapistLeaveRequest[]) {
  await db.insert(clinicSettings)
    .values({
      key: LEAVE_REQUESTS_KEY,
      value: JSON.stringify(requests),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: clinicSettings.key,
      set: { value: JSON.stringify(requests), updatedAt: new Date() },
    });
}

export const leaveRequestService = {
  async getAll() {
    const requests = await readRequests();
    return requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getForTherapist(therapistId: string) {
    const requests = await readRequests();
    return requests
      .filter((request) => request.therapistId === therapistId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async create(therapist: any, data: { type: string; startDate: string; endDate: string; reason?: string }) {
    if (!VALID_TYPES.has(data.type)) {
      throw new Error("Jenis pengajuan tidak valid");
    }

    const request: TherapistLeaveRequest = {
      id: generateId("TLR"),
      therapistId: therapist.id,
      therapistUserId: therapist.userId,
      therapistName: therapist.name || "Terapis",
      therapistNit: therapist.nit,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: (data.reason || "").trim(),
      status: "pending",
      wasApproved: false,
      postApprovalChangeCount: 0,
      history: [{ status: "pending", note: "Pengajuan dibuat oleh terapis.", createdAt: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
    };

    const requests = await readRequests();
    await writeRequests([request, ...requests]);

    await notificationService.create({
      type: "therapist_leave_request",
      icon: "event_busy",
      title: "Pengajuan cuti terapis baru",
      message: `${request.therapistName} mengajukan ${request.type} pada ${request.startDate} - ${request.endDate}.`,
      targetRole: "admin",
      relatedId: request.id,
    });

    return request;
  },

  async updateStatus(id: string, status: LeaveRequestStatus, reviewNote?: string) {
    if (!VALID_STATUSES.has(status)) {
      throw new Error("Status pengajuan tidak valid");
    }

    const requests = await readRequests();
    const index = requests.findIndex((request) => request.id === id);
    if (index === -1) return null;

    const current = requests[index];
    const hasStatusChange = current.status !== status;
    const wasAlreadyApproved = current.wasApproved || current.status === "approved";
    const wasApproved = wasAlreadyApproved || status === "approved";
    const nextChangeCount = wasAlreadyApproved && hasStatusChange
      ? Number(current.postApprovalChangeCount || 0) + 1
      : Number(current.postApprovalChangeCount || 0);
    if (nextChangeCount > 3) {
      throw new Error("Status cuti ini sudah diubah 3x setelah approval. Buat pengajuan baru agar log tetap aman.");
    }

    const next: TherapistLeaveRequest = {
      ...requests[index],
      status,
      reviewNote: (reviewNote || "").trim(),
      reviewedAt: new Date().toISOString(),
      wasApproved,
      postApprovalChangeCount: nextChangeCount,
      history: [
        ...(Array.isArray(current.history) ? current.history : []),
        { status, note: (reviewNote || "").trim(), createdAt: new Date().toISOString() },
      ],
    };
    requests[index] = next;
    await writeRequests(requests);

    if (next.therapistUserId) {
      await notificationService.create({
        type: "therapist_leave_result",
        icon: status === "approved" ? "event_available" : "event_busy",
        title: status === "approved" ? "Pengajuan cuti disetujui" : "Pengajuan cuti diperbarui",
        message: next.reviewNote || `Pengajuan ${next.type} pada ${next.startDate} - ${next.endDate} berstatus ${status}.`,
        targetRole: "therapist",
        targetUserId: next.therapistUserId,
        relatedId: next.id,
      });
    }

    return next;
  },
};
