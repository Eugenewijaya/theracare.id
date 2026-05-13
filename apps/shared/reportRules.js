export const PARENT_VISIBLE_REPORT_STATUSES = ['approved', 'published', 'ready_for_parent'];
export const COMPLETED_SESSION_STATUSES = ['done', 'completed', 'selesai'];
export const REPORT_EDIT_WINDOW_HOURS = 48;

export function isParentVisibleReport(status) {
  return PARENT_VISIBLE_REPORT_STATUSES.includes(String(status || ''));
}

export function isCompletedSession(session) {
  return COMPLETED_SESSION_STATUSES.includes(String(session?.status || '').toLowerCase());
}

export function normalizeDateValue(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value).split('T')[0];
}

export function sessionSortKey(session) {
  return `${normalizeDateValue(session?.date)} ${session?.startTime || session?.time || '00:00'}`;
}

export function getReportPublishedAt(report) {
  if (!report) return null;
  if (report.publishedAt) return report.publishedAt;
  const reviewLog = Array.isArray(report.reviewLog) ? report.reviewLog : [];
  for (let index = reviewLog.length - 1; index >= 0; index -= 1) {
    const entry = reviewLog[index];
    if (isParentVisibleReport(entry?.status) && entry?.createdAt) return entry.createdAt;
  }
  return isParentVisibleReport(report.status)
    ? report.updatedAt || report.createdAt || null
    : null;
}

export function getReportEditWindow(report, now = new Date()) {
  if (typeof report?.canEdit === 'boolean') {
    return {
      canEdit: report.canEdit,
      editLocked: !!report.editLocked,
      publishedAt: report.publishedAt || getReportPublishedAt(report),
      editDeadline: report.editDeadline || null,
      editWindowHours: report.editWindowHours || REPORT_EDIT_WINDOW_HOURS,
      isParentVisible: report.isParentVisible ?? isParentVisibleReport(report.status),
    };
  }

  if (!isParentVisibleReport(report?.status)) {
    return {
      canEdit: true,
      editLocked: false,
      publishedAt: getReportPublishedAt(report),
      editDeadline: null,
      editWindowHours: REPORT_EDIT_WINDOW_HOURS,
      isParentVisible: false,
    };
  }

  const publishedAt = getReportPublishedAt(report);
  if (!publishedAt) {
    return {
      canEdit: false,
      editLocked: true,
      publishedAt: null,
      editDeadline: null,
      editWindowHours: REPORT_EDIT_WINDOW_HOURS,
      isParentVisible: true,
    };
  }
  const publishedTime = new Date(publishedAt).getTime();
  const editDeadline = new Date(publishedTime + REPORT_EDIT_WINDOW_HOURS * 60 * 60 * 1000);
  const canEdit = !Number.isNaN(publishedTime) && now.getTime() <= editDeadline.getTime();
  return {
    canEdit,
    editLocked: !canEdit,
    publishedAt,
    editDeadline: editDeadline.toISOString(),
    editWindowHours: REPORT_EDIT_WINDOW_HOURS,
    isParentVisible: true,
  };
}

export function buildDailyReportQueue(sessions, reports, childId = '') {
  const reportBySessionId = new Map(
    (reports || [])
      .filter((report) => report.type === 'harian' && report.sessionId)
      .map((report) => [report.sessionId, report]),
  );

  return (sessions || [])
    .filter((session) => isCompletedSession(session))
    .filter((session) => !childId || session.childId === childId)
    .sort((a, b) => sessionSortKey(a).localeCompare(sessionSortKey(b)))
    .map((session) => ({
      session,
      report: reportBySessionId.get(session.id) || null,
      missing: !reportBySessionId.has(session.id),
    }));
}

export function findOldestMissingDailyReportSession(sessions, reports, childId = '') {
  return buildDailyReportQueue(sessions, reports, childId).find((row) => row.missing)?.session || null;
}

export function hasPriorMissingDailyReport(sessions, reports, targetSession) {
  if (!targetSession) return null;
  const targetKey = sessionSortKey(targetSession);
  return buildDailyReportQueue(sessions, reports, targetSession.childId)
    .find((row) => row.missing && row.session.id !== targetSession.id && sessionSortKey(row.session) < targetKey)?.session || null;
}
