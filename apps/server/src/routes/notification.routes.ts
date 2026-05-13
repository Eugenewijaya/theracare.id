import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { auditLogService } from "../services/audit-log.service.js";
import { notificationService } from "../services/notification.service.js";
import { ok, created, notFound } from "../utils/response.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try { ok(res, await notificationService.getForUser(req.user!.role, req.user!.id)); } catch (e) { next(e); }
});

router.get("/unread-count", requireAuth, async (req, res, next) => {
  try { ok(res, { count: await notificationService.getUnreadCount(req.user!.role, req.user!.id) }); } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const notification = await notificationService.create(req.body);
    await auditLogService.create({
      actor: req.user,
      action: "notification.create",
      entityType: "notification",
      entityId: notification.id,
      summary: `Notifikasi ${notification.title || notification.id} dibuat`,
      metadata: { targetRole: notification.targetRole, targetUserId: notification.targetUserId || null },
    });
    created(res, notification, "Notifikasi berhasil dibuat");
  } catch (e) { next(e); }
});

router.patch("/:id/read", requireAuth, async (req, res, next) => {
  try { await notificationService.markRead(req.params.id as string, req.user!.id); ok(res, { success: true }); } catch (e) { next(e); }
});

router.post("/read-all", requireAuth, async (req, res, next) => {
  try { await notificationService.markAllRead(req.user!.role, req.user!.id); ok(res, { success: true }); } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await notificationService.delete(req.params.id as string);
    if (!result) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "notification.delete",
      entityType: "notification",
      entityId: req.params.id as string,
      summary: `Notifikasi ${req.params.id} dihapus`,
      metadata: {},
    });
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
