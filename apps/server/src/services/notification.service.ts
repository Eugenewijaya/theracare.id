import { db } from "../db/index.js";
import { auditLogs, clinicSettings, notifications, notificationReads, user as userTable } from "../db/schema.js";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { generateId } from "../utils/id-generators.js";
import { emailService } from "./email.service.js";

type DbClient = typeof db | any;
const CENTER_CLOSURES_KEY = "centerClosures";
const NOTIFICATION_PREFERENCES_KEY = "notificationPreferences";
const DEFAULT_NOTIFICATION_CHANNELS = { email: true, inApp: true };

const NOTIFICATION_CATEGORY_MATCHERS: Array<{ key: string; match: (type: string) => boolean }> = [
  { key: "registration_new", match: (type) => type.includes("registration") || type.includes("child_registered") || type.includes("new_child") },
  { key: "session_reminder", match: (type) => type.includes("session_reminder") || type.includes("schedule_reminder") },
  { key: "reschedule_request", match: (type) => type.includes("reschedule") || type.includes("substitute") || type.includes("schedule_change") },
  { key: "report_uploaded", match: (type) => type.includes("report") },
  { key: "center_closure", match: (type) => type.includes("center_closure") },
];

function getAuditMatchScore(notification: typeof notifications.$inferSelect, log: typeof auditLogs.$inferSelect) {
  const type = String(notification.type || "").toLowerCase();
  const action = String(log.action || "").toLowerCase();
  if (log.entityId === notification.id && action === "notification.create") return 100;
  if (type === "account_security" && action.includes("password")) return 90;
  if (notification.relatedId && log.entityId === notification.relatedId) return 50;
  return 0;
}

function getActorSource(role?: string | null) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "developer" || normalized === "system") return "system";
  if (["admin", "parent", "therapist"].includes(normalized)) return normalized;
  return "system";
}

function parseCenterClosures(value?: string | null): Array<{ id?: string; endDate?: string; startDate?: string; isActive?: boolean }> {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseNotificationPreferences(value?: string | null): Record<string, { email?: boolean; inApp?: boolean }> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getNotificationCategory(type?: string | null) {
  const normalized = String(type || "").toLowerCase();
  return NOTIFICATION_CATEGORY_MATCHERS.find((item) => item.match(normalized))?.key || "";
}

async function getNotificationChannels(type?: string | null) {
  const category = getNotificationCategory(type);
  if (!category) return DEFAULT_NOTIFICATION_CHANNELS;
  const row = await db.query.clinicSettings.findFirst({
    where: eq(clinicSettings.key, NOTIFICATION_PREFERENCES_KEY),
  });
  const preferences = parseNotificationPreferences(row?.value);
  const categoryPreferences = preferences[category] || {};
  return {
    email: typeof categoryPreferences.email === "boolean" ? categoryPreferences.email : DEFAULT_NOTIFICATION_CHANNELS.email,
    inApp: typeof categoryPreferences.inApp === "boolean" ? categoryPreferences.inApp : DEFAULT_NOTIFICATION_CHANNELS.inApp,
  };
}

async function getActiveFutureClosureIds() {
  const row = await db.query.clinicSettings.findFirst({
    where: eq(clinicSettings.key, CENTER_CLOSURES_KEY),
  });
  const today = new Date().toISOString().slice(0, 10);
  return new Set(parseCenterClosures(row?.value)
    .filter((closure) => closure?.id && closure.isActive !== false && (closure.endDate || closure.startDate || "") >= today)
    .map((closure) => closure.id as string));
}

function shouldShowNotificationForUser(
  notification: typeof notifications.$inferSelect,
  userId: string,
  accountCreatedAt: Date | null,
  activeFutureClosureIds: Set<string>,
) {
  if (notification.targetUserId === userId) return true;
  if (!accountCreatedAt) return true;

  const createdAt = notification.createdAt instanceof Date ? notification.createdAt : new Date(notification.createdAt);
  if (!Number.isNaN(createdAt.getTime()) && createdAt >= accountCreatedAt) return true;

  if (String(notification.type || "").toLowerCase() === "center_closure" && notification.relatedId) {
    return activeFutureClosureIds.has(notification.relatedId);
  }

  return false;
}

async function enrichNotificationActors(rows: Array<typeof notifications.$inferSelect>) {
  if (rows.length === 0) return rows;

  const entityIds = [...new Set(rows.flatMap((notification) => [notification.id, notification.relatedId]).filter(Boolean) as string[])];
  if (entityIds.length === 0) return rows;

  const logs = await db.query.auditLogs.findMany({
    where: inArray(auditLogs.entityId, entityIds),
    orderBy: (log, { desc }) => [desc(log.createdAt)],
    limit: 500,
  });
  const actorUserIds = [...new Set(logs.map((log) => log.actorUserId).filter(Boolean) as string[])];
  const actorUsers = actorUserIds.length > 0
    ? await db.select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        role: userTable.role,
      }).from(userTable).where(inArray(userTable.id, actorUserIds))
    : [];
  const usersById = new Map(actorUsers.map((actor) => [actor.id, actor]));

  return rows.map((notification) => {
    const matchedLog = logs
      .filter((log) => log.entityId === notification.id || (notification.relatedId && log.entityId === notification.relatedId))
      .sort((a, b) => getAuditMatchScore(notification, b) - getAuditMatchScore(notification, a))[0];
    const actor = matchedLog?.actorUserId ? usersById.get(matchedLog.actorUserId) : null;
    const actorRole = getActorSource(matchedLog?.actorRole);
    return {
      ...notification,
      actorRole,
      actorName: actor?.name || actor?.email || "",
      actorAction: matchedLog?.action || "",
      actorSummary: matchedLog?.summary || "",
      actorSource: matchedLog ? "audit_log" : "system",
    };
  });
}

export const notificationService = {
  async getForUser(role: string, userId: string) {
    const all = await db.query.notifications.findMany({
      where: and(
        or(eq(notifications.targetRole, role), eq(notifications.targetRole, "all")),
        or(isNull(notifications.targetUserId), eq(notifications.targetUserId, userId)),
      ),
      orderBy: (n, { desc }) => [desc(n.createdAt)],
      limit: 100,
    });
    const [account] = await db.select({ createdAt: userTable.createdAt }).from(userTable).where(eq(userTable.id, userId)).limit(1);
    const accountCreatedAt = account?.createdAt || null;
    const activeFutureClosureIds = await getActiveFutureClosureIds();
    const visibleNotifications = all.filter((notification) => (
      shouldShowNotificationForUser(notification, userId, accountCreatedAt, activeFutureClosureIds)
    ));
    const reads = await db.select({ notificationId: notificationReads.notificationId })
      .from(notificationReads).where(eq(notificationReads.userId, userId));
    const readIds = new Set(reads.map((r) => r.notificationId));
    const enriched = await enrichNotificationActors(visibleNotifications);
    return enriched.map((n) => ({ ...n, isRead: readIds.has(n.id) }));
  },

  async getUnreadCount(role: string, userId: string) {
    const notifs = await this.getForUser(role, userId);
    return notifs.filter((n) => !n.isRead).length;
  },

  async markRead(notifId: string, role: string, userId: string) {
    const notif = await db.query.notifications.findFirst({
      where: and(
        eq(notifications.id, notifId),
        or(eq(notifications.targetRole, role), eq(notifications.targetRole, "all")),
        or(isNull(notifications.targetUserId), eq(notifications.targetUserId, userId)),
      ),
    });
    if (!notif) return null;
    await db.insert(notificationReads).values({ notificationId: notifId, userId }).onConflictDoNothing();
    return { success: true, id: notifId };
  },

  async markAllRead(role: string, userId: string) {
    const notifs = await this.getForUser(role, userId);
    for (const n of notifs) {
      await db.insert(notificationReads).values({ notificationId: n.id, userId }).onConflictDoNothing();
    }
  },

  async create(
    data: { type: string; icon: string; title: string; message: string; targetRole: string; targetUserId?: string; relatedId?: string },
    client: DbClient = db,
  ) {
    const channels = await getNotificationChannels(data.type);
    const id = generateId("NOTIF");
    const [notif] = channels.inApp
      ? await client.insert(notifications).values({ id, ...data }).returning()
      : [{ id, ...data, skippedInApp: true }];
    if (channels.email) {
      emailService.sendNotification(data).catch((error) => {
        console.error("[email] notification delivery failed", error);
      });
    }
    return notif;
  },

  async delete(id: string) {
    const notif = await db.query.notifications.findFirst({ where: eq(notifications.id, id) });
    if (!notif) return null;
    await db.transaction(async (tx) => {
      await tx.delete(notificationReads).where(eq(notificationReads.notificationId, id));
      await tx.delete(notifications).where(eq(notifications.id, id));
    });
    return { deleted: true, id };
  },
};
