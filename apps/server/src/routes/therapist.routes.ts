import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { therapistService } from "../services/therapist.service.js";
import { ok, created, notFound, badRequest, conflict } from "../utils/response.js";

const router = Router();

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
    ok(res, t);
  } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { name, email, phone, specialty, specialization, tempPassword } = req.body;
    if (!name || !email) return badRequest(res, "Nama dan email wajib diisi");
    const result = await therapistService.create({ ...req.body, name, email, phone, specialty: specialty || specialization, tempPassword });
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
    ok(res, result);
  } catch (e) { next(e); }
});

router.patch("/:id/status", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await therapistService.updateStatus(req.params.id as string, req.body.status);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

router.post("/:id/reset-password", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await therapistService.resetPassword(req.params.id as string);
    if (!result) return notFound(res);
    ok(res, result, "Password berhasil direset");
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await therapistService.delete(req.params.id as string);
    if (!result) return notFound(res);
    if ("blocked" in result && result.blocked) return conflict(res, result.reason, result);
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
