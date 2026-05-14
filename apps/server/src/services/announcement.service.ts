import { db } from "../db/index.js";
import { announcements, announcementTargetRoles, notificationReads, notifications } from "../db/schema.js";
import { desc, eq, inArray } from "drizzle-orm";
import { generateId } from "../utils/id-generators.js";
import { notificationService } from "./notification.service.js";

const CATEGORY_ICON: Record<string, string> = {
  general: "campaign",
  schedule: "event_repeat",
  report: "summarize",
  payment: "payments",
  emergency: "priority_high",
  program: "library_books",
};

function normalizeCategory(category?: string) {
  const value = String(category || "general").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(CATEGORY_ICON, value) ? value : "general";
}

function normalizeRoles(targetRoles: string[] = []) {
  const roles = Array.from(new Set(targetRoles.filter(Boolean).map((role) => String(role).trim().toLowerCase())));
  if (roles.includes("all")) return ["admin", "parent", "therapist"];
  return roles.filter((role) => ["admin", "parent", "therapist"].includes(role));
}

async function replaceAnnouncementNotifications(
  id: string,
  title: string,
  content: string,
  targetRoles: string[],
  isActive = true,
  category = "general",
  client: typeof db | any = db,
) {
  const existing = await client.select({ id: notifications.id }).from(notifications).where(eq(notifications.relatedId, id));
  if (existing.length > 0) {
    const ids = existing.map((n: { id: string }) => n.id);
    await client.delete(notificationReads).where(inArray(notificationReads.notificationId, ids));
    await client.delete(notifications).where(eq(notifications.relatedId, id));
  }

  if (!isActive) return;

  const normalizedCategory = normalizeCategory(category);
  for (const role of normalizeRoles(targetRoles)) {
    await notificationService.create({
      type: `announcement_${normalizedCategory}`,
      icon: CATEGORY_ICON[normalizedCategory],
      title,
      message: content || "",
      targetRole: role,
      relatedId: id,
    }, client);
  }
}

export const announcementService = {
  async getAll() {
    const anns = await db.select().from(announcements).orderBy(desc(announcements.createdAt));
    const roles = await db.select().from(announcementTargetRoles);
    return anns.map((a) => ({ ...a, targetRoles: roles.filter((r) => r.announcementId === a.id).map((r) => r.role) }));
  },

  async getForRole(role: string) {
    const requestedRole = String(role || "").toLowerCase();
    const allowedRole = requestedRole === "all" ? "all" : requestedRole;
    const roles = allowedRole === "all"
      ? await db.select().from(announcementTargetRoles)
      : await db.select().from(announcementTargetRoles).where(eq(announcementTargetRoles.role, allowedRole));
    const annIds = roles.map((r) => r.announcementId);
    if (annIds.length === 0) return [];
    const anns = await db.select().from(announcements).where(eq(announcements.isActive, true));
    return anns.filter((a) => annIds.includes(a.id)).map((a) => ({
      ...a, targetRoles: roles.filter((r) => r.announcementId === a.id).map((r) => r.role),
    }));
  },

  async create(data: { title: string; content?: string; targetRoles: string[]; createdBy: string; category?: string }) {
    return db.transaction(async (tx) => {
      const id = generateId("ANN");
      const targetRoles = normalizeRoles(data.targetRoles || []);
      const category = normalizeCategory(data.category);
      const [ann] = await tx.insert(announcements).values({ id, title: data.title, content: data.content, category, createdBy: data.createdBy }).returning();
      if (targetRoles.length > 0) {
        await tx.insert(announcementTargetRoles).values(targetRoles.map((role) => ({ announcementId: id, role })));
        await replaceAnnouncementNotifications(id, data.title, data.content || "", targetRoles, true, category, tx);
      }
      return { ...ann, targetRoles };
    });
  },

  async update(id: string, updates: { title?: string; content?: string; category?: string; isActive?: boolean; targetRoles?: string[] }) {
    return db.transaction(async (tx) => {
      const { targetRoles, ...announcementUpdates } = updates;
      if (typeof announcementUpdates.category === "string") {
        announcementUpdates.category = normalizeCategory(announcementUpdates.category);
      }
      const [updated] = Object.keys(announcementUpdates).length > 0
        ? await tx.update(announcements).set(announcementUpdates).where(eq(announcements.id, id)).returning()
        : await tx.select().from(announcements).where(eq(announcements.id, id)).limit(1);
      if (!updated) return null;

      const roles = Array.isArray(targetRoles)
        ? normalizeRoles(targetRoles)
        : (await tx.select().from(announcementTargetRoles).where(eq(announcementTargetRoles.announcementId, id))).map((r) => r.role);

      if (Array.isArray(targetRoles)) {
        await tx.delete(announcementTargetRoles).where(eq(announcementTargetRoles.announcementId, id));
        if (roles.length > 0) {
          await tx.insert(announcementTargetRoles).values(roles.map((role) => ({ announcementId: id, role })));
        }
      }

      await replaceAnnouncementNotifications(id, updated.title, updated.content || "", roles, updated.isActive, updated.category, tx);
      return { ...updated, targetRoles: roles };
    });
  },

  async delete(id: string) {
    await db.transaction(async (tx) => {
      const existing = await tx.select({ id: notifications.id }).from(notifications).where(eq(notifications.relatedId, id));
      if (existing.length > 0) {
        await tx.delete(notificationReads).where(inArray(notificationReads.notificationId, existing.map((n) => n.id)));
        await tx.delete(notifications).where(eq(notifications.relatedId, id));
      }
      await tx.delete(announcementTargetRoles).where(eq(announcementTargetRoles.announcementId, id));
      await tx.delete(announcements).where(eq(announcements.id, id));
    });
  },
};
