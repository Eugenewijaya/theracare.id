import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicSettings } from "../db/schema.js";
import { generateId } from "../utils/id-generators.js";
import { notificationService } from "./notification.service.js";
import { notifyTherapistScheduleConflicts } from "./schedule-conflict-notification.service.js";

const LEAVE_REQUESTS_KEY = "therapistLeaveRequests";
const VALID_TYPES = new Set(["cuti", "sakit", "unpaid_leave"]);
const VALID_STATUSES = new Set(["pending", "approved", "rejected"]);
const POST_APPROVAL_CHANGE_LIMIT = 3;
const APP_TIME_ZONE = "Asia/Jakarta";

type LeaveRequestStatus = "pending" | "approved" | "rejected" | "completed";

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
  postApprovalChangeLimit?: number;
  remainingPostApprovalChanges?: number;
  canChangeStatus?: boolean;
  changeBlockedReason?: string;
  changeStatus?: "open" | "completed";
  changeStatusLabel?: string;
  changeStatusDetail?: string;
  isChangeLimitReached?: boolean;
  isExpired?: boolean;
  isFinalRejected?: boolean;
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

function normalizeDateKey(value?: string | null) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const date = new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "" : raw;
}

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}

function getPostApprovalChangeCount(request: TherapistLeaveRequest) {
  const count = Number(request.postApprovalChangeCount || 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function getChangePolicy(request: TherapistLeaveRequest) {
  const changeCount = getPostApprovalChangeCount(request);
  const remainingPostApprovalChanges = Math.max(0, POST_APPROVAL_CHANGE_LIMIT - changeCount);
  const hasApprovalHistory = Boolean(request.wasApproved || request.status === "approved" || changeCount > 0);
  const endDate = normalizeDateKey(request.endDate);
  const isExpired = Boolean(endDate && endDate < todayKey());
  const isFinalRejected = request.status === "rejected";
  const isCompleted = request.status === "completed";
  const isChangeLimitReached = hasApprovalHistory && remainingPostApprovalChanges <= 0;

  let changeBlockedReason = "";
  if (isFinalRejected) {
    changeBlockedReason = "Pengajuan ini sudah ditolak final. Terapis perlu membuat pengajuan baru jika masih diperlukan.";
  } else if (isCompleted || isExpired) {
    changeBlockedReason = "Tanggal pengajuan ini sudah lewat. Terapis perlu membuat pengajuan baru agar riwayat cuti tidak bertumpuk.";
  } else if (isChangeLimitReached) {
    changeBlockedReason = "Kuota 3x perubahan setelah disetujui sudah habis. Terapis perlu membuat pengajuan baru.";
  }

  const canChangeStatus = !changeBlockedReason;
  const changeStatus = canChangeStatus ? "open" : "completed";
  const changeStatusDetail = hasApprovalHistory
    ? `Perubahan status ${changeCount}/${POST_APPROVAL_CHANGE_LIMIT}`
    : (isCompleted || isExpired)
      ? "Tanggal lewat otomatis selesai"
      : "Belum pernah disetujui";

  return {
    postApprovalChangeLimit: POST_APPROVAL_CHANGE_LIMIT,
    remainingPostApprovalChanges,
    canChangeStatus,
    changeBlockedReason,
    changeStatus,
    changeStatusLabel: changeStatus === "completed" ? "Selesai" : "Aktif",
    changeStatusDetail,
    isChangeLimitReached,
    isExpired,
    isFinalRejected,
  };
}

function withChangePolicy(request: TherapistLeaveRequest) {
  return {
    ...request,
    ...getChangePolicy(request),
  };
}

function shouldAutoCompleteExpiredPending(request: TherapistLeaveRequest) {
  const endDate = normalizeDateKey(request.endDate);
  return request.status === "pending" && Boolean(endDate && endDate < todayKey());
}

function completeExpiredPendingRequests(requests: TherapistLeaveRequest[]) {
  let changed = false;
  const now = new Date().toISOString();
  const nextRequests = requests.map((request) => {
    if (!shouldAutoCompleteExpiredPending(request)) return request;
    changed = true;
    return {
      ...request,
      status: "completed" as LeaveRequestStatus,
      reviewNote: request.reviewNote || "Tanggal pengajuan sudah lewat otomatis ditandai selesai.",
      reviewedAt: request.reviewedAt || now,
      history: [
        ...(Array.isArray(request.history) ? request.history : []),
        {
          status: "completed" as LeaveRequestStatus,
          note: "Tanggal pengajuan sudah lewat otomatis ditandai selesai.",
          createdAt: now,
        },
      ],
    };
  });
  return { requests: nextRequests, changed };
}

async function readRequests() {
  const row = await db.query.clinicSettings.findFirst({
    where: eq(clinicSettings.key, LEAVE_REQUESTS_KEY),
  });
  const parsed = parseRequests(row?.value);
  const completed = completeExpiredPendingRequests(parsed);
  if (completed.changed) {
    await writeRequests(completed.requests);
  }
  return completed.requests;
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
    return requests
      .map(withChangePolicy)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getForTherapist(therapistId: string) {
    const requests = await readRequests();
    return requests
      .filter((request) => request.therapistId === therapistId)
      .map(withChangePolicy)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async create(therapist: any, data: { type: string; startDate: string; endDate: string; reason?: string }) {
    if (!VALID_TYPES.has(data.type)) {
      throw new Error("Jenis pengajuan tidak valid");
    }
    const startDate = normalizeDateKey(data.startDate);
    const endDate = normalizeDateKey(data.endDate);
    if (!startDate || !endDate) {
      throw new Error("Format tanggal pengajuan tidak valid");
    }
    if (endDate < startDate) {
      throw new Error("Tanggal selesai tidak boleh sebelum tanggal mulai");
    }

    const requests = await readRequests();
    const overlapping = requests.find((request) => (
      request.therapistId === therapist.id
      && ["pending", "approved"].includes(request.status)
      && rangesOverlap(startDate, endDate, request.startDate, request.endDate)
    ));
    if (overlapping) {
      throw new Error(`Sudah ada pengajuan ${overlapping.status} pada rentang tanggal yang bentrok.`);
    }

    const request: TherapistLeaveRequest = {
      id: generateId("TLR"),
      therapistId: therapist.id,
      therapistUserId: therapist.userId,
      therapistName: therapist.name || "Terapis",
      therapistNit: therapist.nit,
      type: data.type,
      startDate,
      endDate,
      reason: (data.reason || "").trim(),
      status: "pending",
      wasApproved: false,
      postApprovalChangeCount: 0,
      history: [{ status: "pending", note: "Pengajuan dibuat oleh terapis.", createdAt: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
    };

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
    const changePolicy = getChangePolicy(current);
    if (!changePolicy.canChangeStatus) {
      throw new Error(changePolicy.changeBlockedReason || "Pengajuan ini sudah tidak dapat diubah. Terapis perlu membuat pengajuan baru.");
    }

    if (status === "approved") {
      const conflictingApproved = requests.find((request) => (
        request.id !== id
        && request.therapistId === current.therapistId
        && request.status === "approved"
        && rangesOverlap(current.startDate, current.endDate, request.startDate, request.endDate)
      ));
      if (conflictingApproved) {
        throw new Error("Ada cuti lain yang sudah disetujui pada rentang tanggal yang bentrok.");
      }
    }
    const wasAlreadyApproved = current.wasApproved || current.status === "approved";
    const wasApproved = wasAlreadyApproved || status === "approved";
    const nextChangeCount = wasAlreadyApproved && hasStatusChange
      ? getPostApprovalChangeCount(current) + 1
      : getPostApprovalChangeCount(current);
    if (nextChangeCount > POST_APPROVAL_CHANGE_LIMIT) {
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

    if (status === "approved") {
      await notifyTherapistScheduleConflicts(next.therapistId);
    }

    return withChangePolicy(next);
  },
};
