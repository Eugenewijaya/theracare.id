import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { leaveRequestService } from "../services/leave-request.service.js";
import { ok, created, notFound, badRequest } from "../utils/response.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (_req, res, next) => {
  try { ok(res, await leaveRequestService.getAll()); } catch (e) { next(e); }
});

router.get("/therapist/me", requireAuth, requireRole("therapist"), async (req, res, next) => {
  try {
    const therapist = await leaveRequestService.getTherapistByUserId(req.user!.id);
    if (!therapist) return notFound(res, "Profil terapis tidak ditemukan");
    ok(res, await leaveRequestService.getForTherapist(therapist.id));
  } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("therapist"), async (req, res, next) => {
  try {
    const therapist = await leaveRequestService.getTherapistByUserId(req.user!.id);
    if (!therapist) return notFound(res, "Profil terapis tidak ditemukan");
    const { startDate, endDate, reason } = req.body || {};
    if (!startDate || !endDate || !reason) return badRequest(res, "Tanggal mulai, tanggal selesai, dan alasan wajib diisi");
    created(res, await leaveRequestService.create(req.body, therapist.id), "Pengajuan cuti berhasil dikirim");
  } catch (e) { next(e); }
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await leaveRequestService.updateStatus(
      req.params.id as string,
      req.body?.status,
      req.body?.reviewNote,
      req.user!.id
    );
    if (!result) return notFound(res);
    ok(res, result, "Status cuti berhasil diperbarui");
  } catch (e) { next(e); }
});

export default router;
