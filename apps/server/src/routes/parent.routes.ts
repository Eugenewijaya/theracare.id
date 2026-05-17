import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { parentService } from "../services/parent.service.js";
import { ok, created, notFound, badRequest, conflict } from "../utils/response.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await parentService.getAll()); } catch (e) { next(e); }
});

router.get("/login-identity/:phone", async (req, res, next) => {
  try {
    const identity = await parentService.getLoginIdentity(req.params.phone as string);
    if (!identity) return notFound(res, "Nomor HP belum terdaftar atau akun ditangguhkan");
    ok(res, identity);
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
    if (req.user?.role === "parent") {
      const currentParent = await parentService.getByUserId(req.user.id);
      if (!currentParent || currentParent.id !== req.params.id) {
        return res.status(403).json({ success: false, error: "Akses profil orang tua ditolak" });
      }
    } else if (req.user?.role !== "admin") {
      return res.status(403).json({ success: false, error: "Akses profil orang tua ditolak" });
    }
    const parent = await parentService.getById(req.params.id as string);
    if (!parent) return notFound(res);
    ok(res, parent);
  } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { name, email, phone, address } = req.body;
    if (!name || (!email && !phone)) return badRequest(res, "Nama dan email atau nomor HP wajib diisi");
    const lastId = await parentService.getLastId();
    const result = await parentService.create({ name, email, phone, address }, lastId);
    created(res, result, "Akun orang tua berhasil dibuat");
  } catch (e) { next(e); }
});

router.patch("/:id/status", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await parentService.updateStatus(req.params.id as string, req.body.status);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    if (req.user?.role !== "admin") {
      if (req.user?.role !== "parent") {
        return res.status(403).json({ success: false, error: "Akses ditolak" });
      }
      const currentParent = await parentService.getByUserId(req.user.id);
      if (!currentParent || currentParent.id !== req.params.id) {
        return res.status(403).json({ success: false, error: "Akses profil orang tua ditolak" });
      }
      req.body = req.body || {};
      delete req.body.status;
    }
    const result = await parentService.update(req.params.id as string, req.body || {});
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

router.post("/:id/reset-password", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await parentService.resetPassword(req.params.id as string);
    if (!result) return notFound(res);
    ok(res, result, "Password berhasil direset");
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await parentService.delete(req.params.id as string);
    if (!result) return notFound(res);
    if ("blocked" in result && result.blocked) return conflict(res, result.reason || "Akun tidak dapat dihapus", result);
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
