import { db } from "../db/index.js";
import { notifications, notificationReads } from "../db/schema.js";
import { eq, or } from "drizzle-orm";
import { generateId } from "../utils/id-generators.js";
import { emailService } from "./email.service.js";

export const notificationService = {
  async getForUser(role: string, userId: string) {
    const all = await db.query.notifications.findMany({
      where: or(eq(notifications.targetRole, role), eq(notifications.targetRole, "all")),
      orderBy: (n, { desc }) => [desc(n.createdAt)],
      limit: 100,
    });
    const visible = all.filter((n) => !n.targetUserId || n.targetUserId === userId);
    const reads = await db.select({ notificationId: notificationReads.notificationId })
      .from(notificationReads).where(eq(notificationReads.userId, userId));
    const readIds = new Set(reads.map((r) => r.notificationId));
    return visible.map((n) => ({ ...n, isRead: readIds.has(n.id) }));
  },

  async getUnreadCount(role: string, userId: string) {
    const notifs = await this.getForUser(role, userId);
    return notifs.filter((n) => !n.isRead).length;
  },

  async markRead(notifId: string, userId: string) {
    await db.insert(notificationReads).values({ notificationId: notifId, userId }).onConflictDoNothing();
  },

  async markAllRead(role: string, userId: string) {
    const notifs = await this.getForUser(role, userId);
    for (const n of notifs) {
      await db.insert(notificationReads).values({ notificationId: n.id, userId }).onConflictDoNothing();
    }
  },

  async create(data: { type: string; icon: string; title: string; message: string; targetRole: string; targetUserId?: string; relatedId?: string }) {
    const id = generateId("NOTIF");
    const [notif] = await db.insert(notifications).values({ id, ...data }).returning();
    emailService.sendNotification(data).catch((error) => {
      console.error("[email] notification delivery failed", error);
    });
    return notif;
  },

  async delete(id: string) {
    const notif = await db.query.notifications.findFirst({ where: eq(notifications.id, id) });
    if (!notif) return null;
    await db.delete(notificationReads).where(eq(notificationReads.notificationId, id));
    await db.delete(notifications).where(eq(notifications.id, id));
    return { deleted: true, id };
  },
};
