import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { meetingService } from "../services/meeting.service.js";
import { ok, created, notFound, badRequest } from "../utils/response.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (_req, res, next) => {
  try { ok(res, await meetingService.getAll()); } catch (e) { next(e); }
});

router.get("/therapist/me", requireAuth, requireRole("therapist"), async (req, res, next) => {
  try {
    const therapist = await meetingService.getTherapistByUserId(req.user!.id);
    if (!therapist) return notFound(res, "Profil terapis tidak ditemukan");
    ok(res, await meetingService.getForTherapist(therapist.id));
  } catch (e) { next(e); }
});

router.get("/parent/me", requireAuth, requireRole("parent"), async (req, res, next) => {
  try {
    const parent = await meetingService.getParentByUserId(req.user!.id);
    if (!parent) return notFound(res, "Profil orang tua tidak ditemukan");
    ok(res, await meetingService.getForParent(parent.id));
  } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("admin", "therapist"), async (req, res, next) => {
  try {
    const { childId, date, time } = req.body || {};
    if (!childId || !date || !time) return badRequest(res, "childId, date, dan time wajib diisi");
    if (req.user!.role === "admin" && !req.body.parentContactConfirmed) {
      return badRequest(res, "Admin wajib mengonfirmasi orang tua sudah dihubungi dan menyetujui jadwal.");
    }
    const meeting = await meetingService.create(req.body, { id: req.user!.id, role: req.user!.role });
    if (!meeting) return badRequest(res, "Data anak atau terapis tidak valid");
    created(res, meeting, "Parent meeting berhasil diajukan");
  } catch (e) { next(e); }
});

router.patch("/:id/admin-review", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const status = req.body?.status || "approved_by_admin";
    if (status === "approved_by_admin" && !req.body?.parentContactConfirmed) {
      return badRequest(res, "Konfirmasi bahwa orang tua sudah dihubungi dan setuju sebelum approve.");
    }
    const meeting = await meetingService.adminReview(req.params.id as string, req.body, req.user!.id);
    if (!meeting) return notFound(res);
    ok(res, meeting, "Parent meeting berhasil direview");
  } catch (e) { next(e); }
});

router.patch("/:id/parent-response", requireAuth, requireRole("parent"), async (req, res, next) => {
  try {
    const parent = await meetingService.getParentByUserId(req.user!.id);
    if (!parent) return notFound(res, "Profil orang tua tidak ditemukan");
    const status = req.body?.status === "parent_declined" ? "parent_declined" : "parent_confirmed";
    const meeting = await meetingService.parentResponse(req.params.id as string, parent.id, status, req.body?.note);
    if (!meeting) return notFound(res);
    ok(res, meeting, "Respons parent meeting tersimpan");
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await meetingService.delete(req.params.id as string);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
