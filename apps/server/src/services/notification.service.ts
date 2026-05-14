import { db } from "../db/index.js";
import { notifications, notificationReads } from "../db/schema.js";
import { and, eq, isNull, or } from "drizzle-orm";
import { generateId } from "../utils/id-generators.js";
import { emailService } from "./email.service.js";

type DbClient = typeof db | any;

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
    const reads = await db.select({ notificationId: notificationReads.notificationId })
      .from(notificationReads).where(eq(notificationReads.userId, userId));
    const readIds = new Set(reads.map((r) => r.notificationId));
    return all.map((n) => ({ ...n, isRead: readIds.has(n.id) }));
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
    const id = generateId("NOTIF");
    const [notif] = await client.insert(notifications).values({ id, ...data }).returning();
    emailService.sendNotification(data).catch((error) => {
      console.error("[email] notification delivery failed", error);
    });
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
