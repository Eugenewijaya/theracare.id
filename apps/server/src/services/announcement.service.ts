import { db } from "../db/index.js";
import { announcements, announcementTargetRoles } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateId } from "../utils/id-generators.js";
import { notificationService } from "./notification.service.js";

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
    const [ann] = await db.insert(announcements).values({ id, title: data.title, content: data.content, createdBy: data.createdBy }).returning();
    if (data.targetRoles.length > 0) {
      await db.insert(announcementTargetRoles).values(data.targetRoles.map((role) => ({ announcementId: id, role })));
      for (const role of data.targetRoles) {
        await notificationService.create({
          type: "announcement",
          icon: "campaign",
          title: data.title,
          message: data.content || "",
          targetRole: role,
          relatedId: id,
        });
      }
    }
    return { ...ann, targetRoles: data.targetRoles };
  },

  async update(id: string, updates: { title?: string; content?: string; isActive?: boolean }) {
    const [updated] = await db.update(announcements).set(updates).where(eq(announcements.id, id)).returning();
    return updated;
  },

  async delete(id: string) {
    await db.delete(announcementTargetRoles).where(eq(announcementTargetRoles.announcementId, id));
    await db.delete(announcements).where(eq(announcements.id, id));
  },
};
