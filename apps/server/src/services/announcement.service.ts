import { db } from "../db/index.js";
import { announcements, announcementTargetRoles, notificationReads, notifications } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { generateId } from "../utils/id-generators.js";
import { notificationService } from "./notification.service.js";

async function replaceAnnouncementNotifications(id: string, title: string, content: string, targetRoles: string[], isActive = true) {
  const existing = await db.select({ id: notifications.id }).from(notifications).where(eq(notifications.relatedId, id));
  if (existing.length > 0) {
    const ids = existing.map((n) => n.id);
    await db.delete(notificationReads).where(inArray(notificationReads.notificationId, ids));
    await db.delete(notifications).where(eq(notifications.relatedId, id));
  }

  if (!isActive) return;

  for (const role of Array.from(new Set(targetRoles.filter(Boolean)))) {
    await notificationService.create({
      type: "announcement",
      icon: "campaign",
      title,
      message: content || "",
      targetRole: role,
      relatedId: id,
    });
  }
}

export const announcementService = {
  async getAll() {
    const anns = await db.select().from(announcements).orderBy(announcements.createdAt);
    const roles = await db.select().from(announcementTargetRoles);
    return anns.map((a) => ({ ...a, targetRoles: roles.filter((r) => r.announcementId === a.id).map((r) => r.role) }));
  },

  async getForRole(role: string) {
    const roles = await db.select().from(announcementTargetRoles).where(eq(announcementTargetRoles.role, role));
    const annIds = roles.map((r) => r.announcementId);
    if (annIds.length === 0) return [];
    const anns = await db.select().from(announcements).where(eq(announcements.isActive, true));
    return anns.filter((a) => annIds.includes(a.id)).map((a) => ({
      ...a, targetRoles: roles.filter((r) => r.announcementId === a.id).map((r) => r.role),
    }));
  },

  async create(data: { title: string; content?: string; targetRoles: string[]; createdBy: string }) {
    const id = generateId("ANN");
    const targetRoles = Array.from(new Set((data.targetRoles || []).filter(Boolean)));
    const [ann] = await db.insert(announcements).values({ id, title: data.title, content: data.content, createdBy: data.createdBy }).returning();
    if (targetRoles.length > 0) {
      await db.insert(announcementTargetRoles).values(targetRoles.map((role) => ({ announcementId: id, role })));
      await replaceAnnouncementNotifications(id, data.title, data.content || "", targetRoles, true);
    }
    return { ...ann, targetRoles };
  },

  async update(id: string, updates: { title?: string; content?: string; isActive?: boolean; targetRoles?: string[] }) {
    const { targetRoles, ...announcementUpdates } = updates;
    const [updated] = Object.keys(announcementUpdates).length > 0
      ? await db.update(announcements).set(announcementUpdates).where(eq(announcements.id, id)).returning()
      : await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
    if (!updated) return null;

    const roles = Array.isArray(targetRoles)
      ? Array.from(new Set(targetRoles.filter(Boolean)))
      : (await db.select().from(announcementTargetRoles).where(eq(announcementTargetRoles.announcementId, id))).map((r) => r.role);

    if (Array.isArray(targetRoles)) {
      await db.delete(announcementTargetRoles).where(eq(announcementTargetRoles.announcementId, id));
      if (roles.length > 0) {
        await db.insert(announcementTargetRoles).values(roles.map((role) => ({ announcementId: id, role })));
      }
    }

    await replaceAnnouncementNotifications(id, updated.title, updated.content || "", roles, updated.isActive);
    return { ...updated, targetRoles: roles };
  },

  async delete(id: string) {
    const existing = await db.select({ id: notifications.id }).from(notifications).where(eq(notifications.relatedId, id));
    if (existing.length > 0) {
      await db.delete(notificationReads).where(inArray(notificationReads.notificationId, existing.map((n) => n.id)));
      await db.delete(notifications).where(eq(notifications.relatedId, id));
    }
    await db.delete(announcementTargetRoles).where(eq(announcementTargetRoles.announcementId, id));
    await db.delete(announcements).where(eq(announcements.id, id));
  },
};
