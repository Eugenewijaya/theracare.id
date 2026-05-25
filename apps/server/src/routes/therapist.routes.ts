import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { auditLogService } from "../services/audit-log.service.js";
import { notificationService } from "../services/notification.service.js";
import { therapistService } from "../services/therapist.service.js";
import { ok, created, notFound, badRequest, conflict } from "../utils/response.js";
import { getRequestClientMeta } from "../utils/request-context.js";

const router = Router();

async function canAccessTherapist(req: any, therapistId: string) {
  if (req.user?.role === "admin") return true;
  if (req.user?.role !== "therapist") return false;
  const ownProfile = await therapistService.getByUserId(req.user.id);
  return ownProfile?.id === therapistId;
}

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await therapistService.getAll()); } catch (e) { next(e); }
});

router.get("/login-identity/:nit", async (req, res, next) => {
  try {
    const identity = await therapistService.getLoginIdentity(req.params.nit as string);
    if (!identity) return notFound(res, "NIT belum terdaftar atau akun ditangguhkan");
    ok(res, identity);
  } catch (e) { next(e); }
});

router.post("/portal-login", async (req, res, next) => {
  try {
    const { nit, password } = req.body || {};
    if (!nit || !password) return badRequest(res, "NIT dan password wajib diisi");
    const result = await therapistService.portalLogin(nit, password, getRequestClientMeta(req));
    if (!result) return res.status(401).json({ success: false, error: "NIT atau password tidak valid" });
    ok(res, result, "Login berhasil");
  } catch (e) { next(e); }
});

router.get("/me/profile", requireAuth, requireRole("therapist"), async (req, res, next) => {
  try {
    const therapist = await therapistService.getByUserId(req.user!.id);
    if (!therapist) return notFound(res);
    ok(res, therapist);
  } catch (e) { next(e); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const t = await therapistService.getById(req.params.id as string);
    if (!t) return notFound(res);
    if (!(await canAccessTherapist(req, req.params.id as string))) {
      return res.status(403).json({ success: false, error: "Akses data terapis ditolak" });
    }
    ok(res, t);
  } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { name, email, phone, specialty, specialization, tempPassword } = req.body;
    if (!name || !email) return badRequest(res, "Nama dan email wajib diisi");
    const result = await therapistService.create({ ...req.body, name, email, phone, specialty: specialty || specialization, tempPassword });
    await auditLogService.create({
      actor: req.user,
      action: "therapist.create",
      entityType: "therapist",
      entityId: result.id,
      summary: `Akun terapis ${result.name} dibuat`,
      metadata: { email: result.email || email, nit: result.nit },
    });
    created(res, result, "Akun terapis berhasil dibuat");
  } catch (e) { next(e); }
});

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    if (req.user!.role !== "admin") {
      if (req.user!.role !== "therapist") {
        return res.status(403).json({ success: false, error: "Akses ditolak" });
      }
      const ownProfile = await therapistService.getByUserId(req.user!.id);
      if (!ownProfile || ownProfile.id !== req.params.id) {
        return res.status(403).json({ success: false, error: "Akses ditolak" });
      }
    }
    const result = await therapistService.updateProfile(req.params.id as string, req.body);
    if (!result) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: req.user?.role === "admin" ? "therapist.update" : "therapist.profile.update",
      entityType: "therapist",
      entityId: req.params.id as string,
      summary: `Profil terapis ${result.name || req.params.id} diperbarui`,
      metadata: { changedFields: Object.keys(req.body || {}) },
    });
    ok(res, result);
  } catch (e) { next(e); }
});

router.patch("/:id/status", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await therapistService.updateStatus(req.params.id as string, req.body.status);
    if (!result) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "therapist.status.update",
      entityType: "therapist",
      entityId: req.params.id as string,
      summary: `Status terapis diubah menjadi ${req.body.status}`,
      metadata: { status: req.body.status },
    });
    ok(res, result);
  } catch (e) { next(e); }
});

router.post("/:id/reset-password", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await therapistService.resetPassword(req.params.id as string, req.body?.tempPassword);
    if (!result) return notFound(res);
    const therapist = await therapistService.getById(req.params.id as string);
    await auditLogService.create({
      actor: req.user,
      action: "therapist.password.reset",
      entityType: "therapist",
      entityId: req.params.id as string,
      summary: `Password akun terapis ${req.params.id} direset`,
      metadata: { forcedByAdmin: true },
    });
    if (therapist?.userId) {
      await notificationService.create({
        type: "account_security",
        icon: "key",
        title: "Password akun diperbarui",
        message: "Password akun therapist portal telah diperbarui oleh admin.",
        targetRole: "therapist",
        targetUserId: therapist.userId,
        relatedId: req.params.id as string,
      });
    }
    ok(res, result, "Password berhasil direset");
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await therapistService.delete(req.params.id as string);
    if (!result) return notFound(res);
    if ("blocked" in result && result.blocked) return conflict(res, result.reason || "Akun tidak dapat dihapus", result);
    await auditLogService.create({
      actor: req.user,
      action: result.archived ? "therapist.archive" : "therapist.delete",
      entityType: "therapist",
      entityId: req.params.id as string,
      summary: result.archived
        ? `Akun terapis ${req.params.id} diarsipkan`
        : `Akun terapis ${req.params.id} dihapus`,
      metadata: { archived: Boolean(result.archived), reason: result.reason || null },
    });
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
