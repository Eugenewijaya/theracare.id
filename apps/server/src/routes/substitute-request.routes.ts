import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { substituteRequestService } from "../services/substitute-request.service.js";
import { therapistService } from "../services/therapist.service.js";
import { ok, created, badRequest, notFound } from "../utils/response.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (_req, res, next) => {
  try {
    ok(res, await substituteRequestService.getAll());
  } catch (e) {
    next(e);
  }
});

router.get("/therapist/me", requireAuth, requireRole("therapist"), async (req, res, next) => {
  try {
    const therapist = await therapistService.getByUserId(req.user!.id);
    if (!therapist) return notFound(res, "Profil terapis tidak ditemukan");
    ok(res, await substituteRequestService.getForTherapist(therapist.id));
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { sessionId, substituteTherapistId, leaveType } = req.body || {};
    if (!sessionId || !substituteTherapistId || !leaveType) {
      return badRequest(res, "sessionId, substituteTherapistId, dan leaveType wajib diisi");
    }
    const request = await substituteRequestService.createByAdmin(req.body, req.user!.id, req.user);
    created(res, request, "Konfirmasi dikirim ke terapis utama");
  } catch (e) {
    next(e);
  }
});

router.post("/session-update", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { sessionId, updates } = req.body || {};
    if (!sessionId || !updates || typeof updates !== "object") {
      return badRequest(res, "sessionId dan updates wajib diisi");
    }
    const request = await substituteRequestService.createSessionUpdateByAdmin(req.body, req.user!.id, req.user);
    created(res, request, "Konfirmasi perubahan jadwal/program dikirim ke terapis utama");
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/therapist-response", requireAuth, requireRole("therapist"), async (req, res, next) => {
  try {
    const therapist = await therapistService.getByUserId(req.user!.id);
    if (!therapist) return notFound(res, "Profil terapis tidak ditemukan");
    const { decision } = req.body || {};
    if (decision !== "approve" && decision !== "decline") {
      return badRequest(res, "decision harus approve atau decline");
    }
    if (decision === "decline" && String(req.body?.responseNote || "").trim().length < 8) {
      return badRequest(res, "Alasan penolakan wajib diisi dengan jelas");
    }
    const result = await substituteRequestService.respondAsPrimaryTherapist(req.params.id as string, therapist.id, req.body, req.user);
    if (!result) return notFound(res, "Konfirmasi tidak ditemukan");
    ok(res, result);
  } catch (e) {
    next(e);
  }
});

export default router;
