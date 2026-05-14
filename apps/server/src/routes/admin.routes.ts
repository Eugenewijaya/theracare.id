import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { announcementService } from "../services/announcement.service.js";
import { adminService } from "../services/admin.service.js";
import { centerClosureService } from "../services/center-closure.service.js";
import { storageService } from "../services/storage.service.js";
import { auditLogService } from "../services/audit-log.service.js";
import { notificationService } from "../services/notification.service.js";
import { ok, created, notFound, badRequest, conflict } from "../utils/response.js";

const router = Router();

// ── Announcements ──
router.get("/announcements", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await announcementService.getAll()); } catch (e) { next(e); }
});
router.get("/announcements/role/:role", requireAuth, async (req, res, next) => {
  try {
    const requestedRole = req.params.role as string;
    if (req.user?.role !== "admin" && requestedRole !== req.user?.role) {
      return res.status(403).json({ success: false, error: "Akses pengumuman ditolak" });
    }
    ok(res, await announcementService.getForRole(requestedRole));
  } catch (e) { next(e); }
});
router.post("/announcements", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    if (!req.body?.title?.trim()) return badRequest(res, "Judul pengumuman wajib diisi");
    if (!req.body?.content?.trim()) return badRequest(res, "Isi pengumuman wajib diisi");
    if (!Array.isArray(req.body?.targetRoles) || req.body.targetRoles.length === 0) {
      return badRequest(res, "Pilih minimal satu target penerima");
    }
    const announcement = await announcementService.create({ ...req.body, createdBy: req.user!.id });
    await auditLogService.create({
      actor: req.user,
      action: "announcement.create",
      entityType: "announcement",
      entityId: announcement.id,
      summary: `Pengumuman ${announcement.title || announcement.id} dibuat`,
      metadata: { targetRoles: announcement.targetRoles || req.body?.targetRoles || req.body?.targetRole || ["all"], category: announcement.category || req.body?.category || "general" },
    });
    created(res, announcement);
  } catch (e) { next(e); }
});
router.patch("/announcements/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    if (typeof req.body?.title === "string" && !req.body.title.trim()) return badRequest(res, "Judul pengumuman wajib diisi");
    if (typeof req.body?.content === "string" && !req.body.content.trim()) return badRequest(res, "Isi pengumuman wajib diisi");
    if (Array.isArray(req.body?.targetRoles) && req.body.targetRoles.length === 0 && req.body?.isActive !== false) {
      return badRequest(res, "Pilih minimal satu target penerima");
    }
    const result = await announcementService.update(req.params.id as string, req.body);
    if (!result) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "announcement.update",
      entityType: "announcement",
      entityId: req.params.id as string,
      summary: `Pengumuman ${req.params.id} diperbarui`,
      metadata: { changedFields: Object.keys(req.body || {}) },
    });
    ok(res, result);
  } catch (e) { next(e); }
});
router.delete("/announcements/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    await announcementService.delete(req.params.id as string);
    await auditLogService.create({
      actor: req.user,
      action: "announcement.delete",
      entityType: "announcement",
      entityId: req.params.id as string,
      summary: `Pengumuman ${req.params.id} dihapus`,
      metadata: {},
    });
    ok(res, { deleted: true });
  } catch (e) { next(e); }
});

// ── Rooms ──
router.get("/rooms", requireAuth, requireRole("admin", "therapist"), async (req, res, next) => {
  try { ok(res, await adminService.getAllRooms()); } catch (e) { next(e); }
});
router.post("/rooms", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    if (!req.body?.name) return badRequest(res, "Nama ruangan wajib diisi");
    const room = await adminService.createRoom(req.body);
    await auditLogService.create({
      actor: req.user,
      action: "room.create",
      entityType: "room",
      entityId: room.id,
      summary: `Ruangan ${room.name} dibuat`,
      metadata: req.body,
    });
    created(res, room);
  } catch (e) { next(e); }
});
router.patch("/rooms/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await adminService.updateRoom(req.params.id as string, req.body);
    if (!result) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "room.update",
      entityType: "room",
      entityId: req.params.id as string,
      summary: `Ruangan ${result.name || req.params.id} diperbarui`,
      metadata: { changedFields: Object.keys(req.body || {}) },
    });
    ok(res, result);
  } catch (e) { next(e); }
});
router.delete("/rooms/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await adminService.deleteRoom(req.params.id as string);
    if (!result) return notFound(res);
    if ("blocked" in result && result.blocked) return conflict(res, result.reason, result);
    await auditLogService.create({
      actor: req.user,
      action: "room.delete",
      entityType: "room",
      entityId: req.params.id as string,
      summary: `Ruangan ${req.params.id} dihapus`,
      metadata: {},
    });
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
    const program = await adminService.createProgram(req.body);
    await auditLogService.create({
      actor: req.user,
      action: "program.create",
      entityType: "program",
      entityId: program.id,
      summary: `Program layanan ${program.name} dibuat`,
      metadata: req.body,
    });
    await notificationService.create({
      type: "program_catalog_update",
      icon: "library_books",
      title: "Program layanan diperbarui",
      message: `Admin menambahkan program layanan ${program.name}.`,
      targetRole: "admin",
      relatedId: program.id,
    });
    created(res, program);
  } catch (e) { next(e); }
});
router.patch("/programs/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await adminService.updateProgram(req.params.id as string, req.body);
    if (!result) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "program.update",
      entityType: "program",
      entityId: result.id,
      summary: `Program layanan ${result.name} diperbarui`,
      metadata: { changedFields: Object.keys(req.body || {}), requested: req.body },
    });
    await notificationService.create({
      type: "program_catalog_update",
      icon: "library_books",
      title: "Program layanan diperbarui",
      message: `Admin memperbarui program layanan ${result.name}.`,
      targetRole: "admin",
      relatedId: result.id,
    });
    ok(res, result);
  } catch (e) { next(e); }
});
router.delete("/programs/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await adminService.deleteProgram(req.params.id as string);
    if (!result) return notFound(res);
    if ("blocked" in result && result.blocked) return conflict(res, result.reason, result);
    await auditLogService.create({
      actor: req.user,
      action: "program.delete",
      entityType: "program",
      entityId: req.params.id as string,
      summary: `Program layanan ${req.params.id} dihapus`,
      metadata: {},
    });
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
  try {
    await adminService.updateSettings(req.body);
    await auditLogService.create({
      actor: req.user,
      action: "settings.update",
      entityType: "clinic_settings",
      summary: "Pengaturan branding/center diperbarui",
      metadata: { changedFields: Object.keys(req.body || {}) },
    });
    ok(res, { updated: true });
  } catch (e) { next(e); }
});
router.post("/uploads/branding", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { kind, fileName, contentType, dataBase64 } = req.body || {};
    if (!kind || !fileName || !contentType || !dataBase64) {
      return badRequest(res, "kind, fileName, contentType, dan dataBase64 wajib diisi");
    }
    const uploaded = await storageService.uploadBrandingAsset({ kind, fileName, contentType, dataBase64 });
    await auditLogService.create({
      actor: req.user,
      action: "branding.upload",
      entityType: "branding_asset",
      entityId: kind,
      summary: `Asset branding ${kind} diunggah`,
      metadata: { fileName, contentType, url: uploaded.url },
    });
    created(res, uploaded);
  } catch (e) {
    return badRequest(res, e instanceof Error ? e.message : "Upload branding gagal");
  }
});
router.get("/stats", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await adminService.getDashboardStats()); } catch (e) { next(e); }
});

// ── Center operational closures ──
router.get("/center-closures", requireAuth, requireRole("admin", "therapist"), async (_req, res, next) => {
  try { ok(res, await centerClosureService.getAll()); } catch (e) { next(e); }
});
router.get("/center-closures/indonesia-holidays", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());
    ok(res, await centerClosureService.getIndonesianHolidays(year));
  } catch (e) {
    badRequest(res, e instanceof Error ? e.message : "Gagal mengambil tanggal merah Indonesia");
  }
});
router.post("/center-closures/apply-holidays", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await centerClosureService.applyHolidays(req.body || {}, req.user!.id);
    await auditLogService.create({
      actor: req.user,
      action: "center_closure.apply_holidays",
      entityType: "center_closure",
      summary: "Tanggal merah Indonesia diterapkan ke jadwal off center",
      metadata: { added: result.added, request: req.body || {} },
    });
    created(res, result);
  } catch (e) {
    badRequest(res, e instanceof Error ? e.message : "Gagal menerapkan tanggal merah");
  }
});
router.post("/center-closures", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const closure = await centerClosureService.create(req.body, req.user!.id);
    await auditLogService.create({
      actor: req.user,
      action: "center_closure.create",
      entityType: "center_closure",
      entityId: closure.id,
      summary: `Jadwal off center ${closure.title || closure.id} dibuat`,
      metadata: { startDate: closure.startDate, endDate: closure.endDate, type: closure.type },
    });
    created(res, closure);
  } catch (e) {
    badRequest(res, e instanceof Error ? e.message : "Gagal menyimpan jadwal off center");
  }
});
router.patch("/center-closures/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await centerClosureService.update(req.params.id as string, req.body || {});
    if (!result) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "center_closure.update",
      entityType: "center_closure",
      entityId: req.params.id as string,
      summary: `Jadwal off center ${req.params.id} diperbarui`,
      metadata: { changedFields: Object.keys(req.body || {}) },
    });
    ok(res, result);
  } catch (e) {
    badRequest(res, e instanceof Error ? e.message : "Gagal memperbarui jadwal off center");
  }
});
router.delete("/center-closures/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await centerClosureService.delete(req.params.id as string);
    if (!result) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "center_closure.delete",
      entityType: "center_closure",
      entityId: req.params.id as string,
      summary: `Jadwal off center ${req.params.id} dihapus`,
      metadata: {},
    });
    ok(res, result);
  } catch (e) {
    next(e);
  }
});

export default router;
