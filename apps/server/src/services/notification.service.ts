import { db } from "../db/index.js";
import { notifications, notificationReads } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateId } from "../utils/id-generators.js";

export const notificationService = {
  async getForUser(role: string, userId: string) {
    const all = await db.query.notifications.findMany({
      where: eq(notifications.targetRole, role),
      orderBy: (n, { desc }) => [desc(n.createdAt)],
      limit: 100,
    });
    return all.filter((n) => !n.targetUserId || n.targetUserId === userId);
  },

  async getUnreadCount(role: string, userId: string) {
    const notifs = await this.getForUser(role, userId);
    const reads = await db.select({ notificationId: notificationReads.notificationId })
      .from(notificationReads).where(eq(notificationReads.userId, userId));
    const readIds = new Set(reads.map((r) => r.notificationId));
    return notifs.filter((n) => !readIds.has(n.id)).length;
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
    return notif;
  },
};
