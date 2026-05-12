import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { childService } from "../services/child.service.js";
import { auditLogService } from "../services/audit-log.service.js";
import { notificationService } from "../services/notification.service.js";
import { ok, created, notFound, badRequest, conflict } from "../utils/response.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await childService.getAll()); } catch (e) { next(e); }
});

router.get("/by-parent/:parentId", requireAuth, async (req, res, next) => {
  try { ok(res, await childService.getByParent(req.params.parentId as string)); } catch (e) { next(e); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const child = await childService.getById(req.params.id as string);
    if (!child) return notFound(res);
    ok(res, child);
  } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { parentId, firstName, lastName, ...rest } = req.body;
    if (!parentId || !firstName || !lastName) return badRequest(res, "parentId, firstName, dan lastName wajib diisi");
    const child = await childService.create(parentId, { firstName, lastName, ...rest });
    await auditLogService.create({
      actor: req.user,
      action: "child.create",
      entityType: "child",
      entityId: child.id,
      summary: `Data anak ${child.name} dibuat`,
      metadata: { parentId },
    });
    created(res, child, "Anak berhasil didaftarkan");
  } catch (e) { next(e); }
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const updated = await childService.update(req.params.id as string, req.body);
    if (!updated) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "child.update",
      entityType: "child",
      entityId: updated.id,
      summary: `Data anak ${updated.name} diperbarui`,
      metadata: { changedFields: Object.keys(req.body || {}) },
    });
    await notificationService.create({
      type: "audit_child_update",
      icon: "manage_accounts",
      title: "Data anak diperbarui",
      message: `${updated.name} diperbarui oleh ${req.user?.name || "admin"}. Field: ${Object.keys(req.body || {}).join(", ") || "data profil"}.`,
      targetRole: "admin",
      relatedId: updated.id,
    });
    ok(res, updated);
  } catch (e) { next(e); }
});

router.patch("/:id/photo", requireAuth, async (req, res, next) => {
  try {
    const { photoUrl } = req.body || {};
    if (!photoUrl || typeof photoUrl !== "string") return badRequest(res, "photoUrl wajib diisi");
    const existing = await childService.getById(req.params.id as string);
    if (!existing) return notFound(res);
    if (req.user?.role === "parent" && existing.parent?.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: "Akses ditolak - anak tidak terhubung ke akun orang tua ini" });
    }
    const updated = await childService.updatePhoto(req.params.id as string, photoUrl);
    if (!updated) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "child.photo.update",
      entityType: "child",
      entityId: updated.id,
      summary: `Foto anak ${updated.name} diperbarui`,
      metadata: { role: req.user?.role },
    });
    ok(res, updated, "Foto anak berhasil diperbarui");
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await childService.delete(req.params.id as string);
    if (!result) return notFound(res);
    if ("blocked" in result && result.blocked) return conflict(res, result.reason, result);
    await auditLogService.create({
      actor: req.user,
      action: "child.delete",
      entityType: "child",
      entityId: req.params.id as string,
      summary: `Data anak ${req.params.id} dihapus`,
      metadata: {},
    });
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
