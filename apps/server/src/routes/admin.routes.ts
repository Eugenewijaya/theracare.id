import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { announcementService } from "../services/announcement.service.js";
import { adminService } from "../services/admin.service.js";
import { ok, created, notFound, badRequest, conflict } from "../utils/response.js";

const router = Router();

// ── Announcements ──
router.get("/announcements", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await announcementService.getAll()); } catch (e) { next(e); }
});
router.get("/announcements/role/:role", requireAuth, async (req, res, next) => {
  try { ok(res, await announcementService.getForRole(req.params.role as string)); } catch (e) { next(e); }
});
router.post("/announcements", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { created(res, await announcementService.create({ ...req.body, createdBy: req.user!.id })); } catch (e) { next(e); }
});
router.patch("/announcements/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await announcementService.update(req.params.id as string, req.body)); } catch (e) { next(e); }
});
router.delete("/announcements/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { await announcementService.delete(req.params.id as string); ok(res, { deleted: true }); } catch (e) { next(e); }
});

// ── Rooms ──
router.get("/rooms", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await adminService.getAllRooms()); } catch (e) { next(e); }
});
router.post("/rooms", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    if (!req.body?.name) return badRequest(res, "Nama ruangan wajib diisi");
    created(res, await adminService.createRoom(req.body));
  } catch (e) { next(e); }
});
router.patch("/rooms/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await adminService.updateRoom(req.params.id as string, req.body);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});
router.delete("/rooms/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await adminService.deleteRoom(req.params.id as string);
    if (!result) return notFound(res);
    if ("blocked" in result && result.blocked) return conflict(res, result.reason, result);
    ok(res, result);
  } catch (e) { next(e); }
});

// ── Programs ──
router.get("/programs", requireAuth, async (req, res, next) => {
  try { ok(res, await adminService.getAllPrograms()); } catch (e) { next(e); }
});
router.post("/programs", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    if (!req.body?.name) return badRequest(res, "Nama program wajib diisi");
    created(res, await adminService.createProgram(req.body));
  } catch (e) { next(e); }
});
router.patch("/programs/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await adminService.updateProgram(req.params.id as string, req.body);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});
router.delete("/programs/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await adminService.deleteProgram(req.params.id as string);
    if (!result) return notFound(res);
    if ("blocked" in result && result.blocked) return conflict(res, result.reason, result);
    ok(res, result);
  } catch (e) { next(e); }
});

// ── Settings & Stats ──
router.get("/public-settings", async (_req, res, next) => {
  try { ok(res, await adminService.getPublicSettings()); } catch (e) { next(e); }
});
router.get("/settings", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await adminService.getSettings()); } catch (e) { next(e); }
});
router.patch("/settings", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { await adminService.updateSettings(req.body); ok(res, { updated: true }); } catch (e) { next(e); }
});
router.get("/stats", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await adminService.getDashboardStats()); } catch (e) { next(e); }
});

export default router;
