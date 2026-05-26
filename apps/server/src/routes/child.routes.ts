import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { childService } from "../services/child.service.js";
import { parentService } from "../services/parent.service.js";
import { therapistService } from "../services/therapist.service.js";
import { auditLogService } from "../services/audit-log.service.js";
import { notificationService } from "../services/notification.service.js";
import { verifyCredentialPassword } from "../services/auth-password.service.js";
import { ok, created, notFound, badRequest, conflict } from "../utils/response.js";

const router = Router();

async function canAccessParentChildren(req: any, parentId: string) {
  if (req.user?.role === "admin") return true;
  if (req.user?.role !== "parent") return false;
  const parent = await parentService.getByUserId(req.user.id);
  return parent?.id === parentId || parent?.parentId === parentId;
}

async function canAccessChild(req: any, child: any) {
  if (req.user?.role === "admin") return true;
  if (req.user?.role === "parent") {
    return child?.parent?.userId === req.user.id;
  }
  if (req.user?.role === "therapist") {
    const therapist = await therapistService.getByUserId(req.user.id);
    if (!therapist?.id) return false;
    const hasSession = Array.isArray(child?.sessions)
      && child.sessions.some((session: any) => session?.therapistId === therapist.id);
    const hasPeriodRule = Array.isArray(child?.periods)
      && child.periods.some((period: any) => Array.isArray(period?.scheduleRules)
        && period.scheduleRules.some((rule: any) => rule?.therapistId === therapist.id));
    const isAssistant = Array.isArray(child?.periods)
      && child.periods.some((period: any) => Array.isArray(period?.assistantTherapistIds)
        && period.assistantTherapistIds.includes(therapist.id));
    return hasSession || hasPeriodRule || isAssistant;
  }
  return false;
}

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await childService.getAll()); } catch (e) { next(e); }
});

router.get("/by-parent/:parentId", requireAuth, async (req, res, next) => {
  try {
    if (!(await canAccessParentChildren(req, req.params.parentId as string))) {
      return res.status(403).json({ success: false, error: "Akses data anak ditolak" });
    }
    ok(res, await childService.getByParent(req.params.parentId as string));
  } catch (e) { next(e); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const child = await childService.getById(req.params.id as string);
    if (!child) return notFound(res);
    if (!(await canAccessChild(req, child))) {
      return res.status(403).json({ success: false, error: "Akses data anak ditolak" });
    }
    ok(res, child);
  } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { parentId, firstName, lastName, ...rest } = req.body;
    if (!parentId || !firstName) return badRequest(res, "parentId dan firstName wajib diisi");
    const child = await childService.create(parentId, { firstName, lastName: lastName || "", ...rest });
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

router.post("/:id/therapist-reassignment", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const password = String(req.body?.superAdminPassword || "");
    if (!password) return badRequest(res, "Password super admin wajib diisi untuk critical decision.");
    if (!(await verifyCredentialPassword(req.user!.id, password))) {
      return res.status(403).json({ success: false, error: "Password super admin tidak valid." });
    }

    const result = await childService.reassignTherapist(req.params.id as string, {
      roleType: req.body?.roleType,
      fromTherapistId: req.body?.fromTherapistId,
      toTherapistId: req.body?.toTherapistId,
      effectiveDate: req.body?.effectiveDate,
      reason: req.body?.reason,
      transferFutureSessions: req.body?.transferFutureSessions,
      periodId: req.body?.periodId,
    }, req.user);
    if (!result) return notFound(res);
    ok(res, result, "Critical decision penggantian terapis tersimpan");
  } catch (e) { next(e); }
});

router.patch("/:id/photo", requireAuth, async (req, res, next) => {
  try {
    const { photoUrl } = req.body || {};
    if (!photoUrl || typeof photoUrl !== "string") return badRequest(res, "photoUrl wajib diisi");
    const existing = await childService.getById(req.params.id as string);
    if (!existing) return notFound(res);
    if (!(await canAccessChild(req, existing))) {
      return res.status(403).json({ success: false, error: "Akses update foto anak ditolak" });
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
