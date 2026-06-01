export const REPORT_PARENT_VISIBLE_STATUSES = ["approved", "published", "ready_for_parent"] as const;
export const REPORT_REVIEWABLE_STATUSES = [
  "draft",
  "approved",
  "published",
  "ready_for_parent",
  "needs_revision",
  "pending_review",
] as const;
export const RESCHEDULE_OPEN_STATUSES = ["pending", "review", "under_review"] as const;
export const COMPLETED_SESSION_STATUSES = ["done", "completed", "selesai"] as const;
export const SESSION_ATTENDANCE_CONFIRMED_STATUSES = ["confirmed", "checked_in", "present"] as const;
export const SESSION_STATUSES = ["upcoming", "confirmed", "active", "done", "cancelled"] as const;

export type ReportParentVisibleStatus = typeof REPORT_PARENT_VISIBLE_STATUSES[number];
export type ReportReviewableStatus = typeof REPORT_REVIEWABLE_STATUSES[number];
export type RescheduleOpenStatus = typeof RESCHEDULE_OPEN_STATUSES[number];
export type SessionStatus = typeof SESSION_STATUSES[number];

export function isParentVisibleReportStatus(status?: string | null) {
  return !!status && REPORT_PARENT_VISIBLE_STATUSES.includes(status as ReportParentVisibleStatus);
}

export function isReviewableReportStatus(status?: string | null) {
  return !!status && REPORT_REVIEWABLE_STATUSES.includes(status as ReportReviewableStatus);
}

export function isOpenRescheduleStatus(status?: string | null) {
  return !!status && RESCHEDULE_OPEN_STATUSES.includes(status as RescheduleOpenStatus);
}

export function isAttendanceConfirmedSessionStatus(status?: string | null) {
  return !!status && SESSION_ATTENDANCE_CONFIRMED_STATUSES.includes(status as typeof SESSION_ATTENDANCE_CONFIRMED_STATUSES[number]);
}

export function isValidSessionStatus(status?: string | null): status is SessionStatus {
  return !!status && SESSION_STATUSES.includes(status as SessionStatus);
}
