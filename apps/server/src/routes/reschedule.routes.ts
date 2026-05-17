import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { rescheduleService } from "../services/reschedule.service.js";
import { therapistService } from "../services/therapist.service.js";
import { parentService } from "../services/parent.service.js";
import { ok, created, notFound, badRequest } from "../utils/response.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await rescheduleService.getAll()); } catch (e) { next(e); }
});

router.get("/parent/:id", requireAuth, async (req, res, next) => {
  try {
    if (req.user?.role === "parent") {
      const parent = await parentService.getByUserId(req.user.id);
      if (!parent || parent.id !== req.params.id) {
        return res.status(403).json({ success: false, error: "Akses permintaan reschedule ditolak" });
      }
    } else if (req.user?.role !== "admin") {
      return res.status(403).json({ success: false, error: "Akses permintaan reschedule ditolak" });
    }
    ok(res, await rescheduleService.getByParent(req.params.id as string));
  } catch (e) { next(e); }
});

router.get("/therapist/:id", requireAuth, async (req, res, next) => {
  try { ok(res, await rescheduleService.getForTherapist(req.params.id as string)); } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("parent"), async (req, res, next) => {
  try {
    const { parentId, childId, sessionId } = req.body;
    if (!parentId || !childId || !sessionId) return badRequest(res, "Data tidak lengkap");
    const parent = await parentService.getByUserId(req.user!.id);
    if (!parent || parent.id !== parentId) {
      return res.status(403).json({ success: false, error: "Akses akun orang tua ditolak" });
    }
    const ownsChild = (parent.children || []).some((child: any) => child.id === childId || child.nita === childId);
    if (!ownsChild) {
      return res.status(403).json({ success: false, error: "Anak tidak terhubung ke akun orang tua ini" });
    }
    created(res, await rescheduleService.create(req.body), "Permintaan reschedule berhasil dikirim");
  } catch (e) { next(e); }
});

router.patch("/:id/therapist-response", requireAuth, requireRole("therapist"), async (req, res, next) => {
  try {
    const therapist = await therapistService.getByUserId(req.user!.id);
    if (!therapist) return notFound(res, "Profil terapis tidak ditemukan");

    const { status, ...updates } = req.body;
    const result = await rescheduleService.respondAsTherapist(req.params.id as string, therapist.id, status, updates);
    if (!result) return notFound(res);
    ok(res, result, "Respons terapis berhasil disimpan");
  } catch (e) { next(e); }
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { status, ...updates } = req.body;
    const result = await rescheduleService.updateStatus(req.params.id as string, status, updates);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await rescheduleService.delete(req.params.id as string);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
