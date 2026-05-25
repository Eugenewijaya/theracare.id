import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { auditLogService } from "../services/audit-log.service.js";
import { notificationService } from "../services/notification.service.js";
import { parentService } from "../services/parent.service.js";
import { ok, created, notFound, badRequest, conflict } from "../utils/response.js";
import { getRequestClientMeta } from "../utils/request-context.js";

const router = Router();

async function canAccessParent(req: any, parentId: string) {
  if (req.user?.role === "admin") return true;
  if (req.user?.role !== "parent") return false;
  const parent = await parentService.getByUserId(req.user.id);
  return parent?.id === parentId || parent?.parentId === parentId;
}

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await parentService.getAll()); } catch (e) { next(e); }
});

router.get("/login-identity/:identifier", async (req, res, next) => {
  try {
    const identity = await parentService.getLoginIdentity(req.params.identifier as string);
    if (!identity) return notFound(res, "Nomor telepon, Parent ID, atau email orang tua belum terdaftar atau akun ditangguhkan");
    ok(res, identity);
  } catch (e) { next(e); }
});

router.post("/portal-login", async (req, res, next) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) return badRequest(res, "Identitas login dan password wajib diisi");
    const result = await parentService.portalLogin(identifier, password, getRequestClientMeta(req));
    if (!result) return res.status(401).json({ success: false, error: "Identitas login atau password tidak valid" });
    ok(res, result, "Login berhasil");
  } catch (e) { next(e); }
});

router.get("/me/profile", requireAuth, requireRole("parent"), async (req, res, next) => {
  try {
    const parent = await parentService.getByUserId(req.user!.id);
    if (!parent) return notFound(res);
    ok(res, parent);
  } catch (e) { next(e); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const parent = await parentService.getById(req.params.id as string);
    if (!parent) return notFound(res);
    if (!(await canAccessParent(req, req.params.id as string))) {
      return res.status(403).json({ success: false, error: "Akses data orang tua ditolak" });
    }
    ok(res, parent);
  } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { name, email, phone, address, tempPassword } = req.body;
    if (!name || (!email && !phone)) return badRequest(res, "Nama dan email atau nomor HP wajib diisi");
    const lastId = await parentService.getLastId();
    const result = await parentService.create({ name, email, phone, address, tempPassword }, lastId);
    await auditLogService.create({
      actor: req.user,
      action: "parent.create",
      entityType: "parent",
      entityId: result.id,
      summary: `Akun orang tua ${result.name} dibuat`,
      metadata: { phone, email: result.email || email || null },
    });
    created(res, result, "Akun orang tua berhasil dibuat");
  } catch (e) { next(e); }
});

router.patch("/:id/status", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await parentService.updateStatus(req.params.id as string, req.body.status);
    if (!result) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "parent.status.update",
      entityType: "parent",
      entityId: req.params.id as string,
      summary: `Status akun orang tua diubah menjadi ${req.body.status}`,
      metadata: { status: req.body.status },
    });
    ok(res, result);
  } catch (e) { next(e); }
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await parentService.update(req.params.id as string, req.body);
    if (!result) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "parent.update",
      entityType: "parent",
      entityId: req.params.id as string,
      summary: `Profil orang tua ${result.name || req.params.id} diperbarui`,
      metadata: { changedFields: Object.keys(req.body || {}) },
    });
    ok(res, result);
  } catch (e) { next(e); }
});

router.post("/:id/reset-password", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await parentService.resetPassword(req.params.id as string, req.body?.tempPassword);
    if (!result) return notFound(res);
    const parent = await parentService.getById(req.params.id as string);
    await auditLogService.create({
      actor: req.user,
      action: "parent.password.reset",
      entityType: "parent",
      entityId: req.params.id as string,
      summary: `Password akun orang tua ${req.params.id} direset`,
      metadata: { forcedByAdmin: true },
    });
    if (parent?.userId) {
      await notificationService.create({
        type: "account_security",
        icon: "key",
        title: "Password akun diperbarui",
        message: "Password akun parent portal telah diperbarui oleh admin.",
        targetRole: "parent",
        targetUserId: parent.userId,
        relatedId: req.params.id as string,
      });
    }
    ok(res, result, "Password berhasil direset");
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await parentService.delete(req.params.id as string);
    if (!result) return notFound(res);
    if ("blocked" in result && result.blocked) return conflict(res, result.reason || "Akun tidak dapat dihapus", result);
    await auditLogService.create({
      actor: req.user,
      action: result.archived ? "parent.archive" : "parent.delete",
      entityType: "parent",
      entityId: req.params.id as string,
      summary: result.archived
        ? `Akun orang tua ${req.params.id} diarsipkan`
        : `Akun orang tua ${req.params.id} dihapus`,
      metadata: { archived: Boolean(result.archived), reason: result.reason || null },
    });
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
