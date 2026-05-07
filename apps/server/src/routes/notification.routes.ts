import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
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
  try { created(res, await notificationService.create(req.body), "Notifikasi berhasil dibuat"); } catch (e) { next(e); }
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
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
