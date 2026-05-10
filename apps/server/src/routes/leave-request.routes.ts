import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { leaveRequestService } from "../services/leave-request.service.js";
import { therapistService } from "../services/therapist.service.js";
import { ok, created, badRequest, notFound } from "../utils/response.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (_req, res, next) => {
  try {
    ok(res, await leaveRequestService.getAll());
  } catch (e) {
    next(e);
  }
});

router.get("/therapist/me", requireAuth, requireRole("therapist"), async (req, res, next) => {
  try {
    const therapist = await therapistService.getByUserId(req.user!.id);
    if (!therapist) return notFound(res, "Profil terapis tidak ditemukan");
    ok(res, await leaveRequestService.getForTherapist(therapist.id));
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, requireRole("therapist"), async (req, res, next) => {
  try {
    const { type, startDate, endDate, reason } = req.body || {};
    if (!type || !startDate || !endDate) {
      return badRequest(res, "Jenis pengajuan, tanggal mulai, dan tanggal selesai wajib diisi");
    }

    const therapist = await therapistService.getByUserId(req.user!.id);
    if (!therapist) return notFound(res, "Profil terapis tidak ditemukan");

    created(res, await leaveRequestService.create(therapist, { type, startDate, endDate, reason }), "Pengajuan berhasil dikirim");
  } catch (e) {
    return badRequest(res, e instanceof Error ? e.message : "Pengajuan gagal dikirim");
  }
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { status, reviewNote } = req.body || {};
    if (!status) return badRequest(res, "Status wajib diisi");
    const result = await leaveRequestService.updateStatus(req.params.id as string, status, reviewNote);
    if (!result) return notFound(res, "Pengajuan tidak ditemukan");
    ok(res, result);
  } catch (e) {
    return badRequest(res, e instanceof Error ? e.message : "Gagal memperbarui pengajuan");
  }
});

export default router;
