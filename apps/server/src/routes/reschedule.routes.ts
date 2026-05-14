import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { childService } from "../services/child.service.js";
import { parentService } from "../services/parent.service.js";
import { rescheduleService } from "../services/reschedule.service.js";
import { therapistService } from "../services/therapist.service.js";
import { ok, created, notFound, badRequest } from "../utils/response.js";

const router = Router();

async function canAccessParentRequests(req: any, parentId: string) {
  if (req.user?.role === "admin") return true;
  if (req.user?.role !== "parent") return false;
  const parent = await parentService.getByUserId(req.user.id);
  return parent?.id === parentId || parent?.parentId === parentId;
}

async function canAccessTherapistRequests(req: any, therapistId: string) {
  if (req.user?.role === "admin") return true;
  if (req.user?.role !== "therapist") return false;
  const therapist = await therapistService.getByUserId(req.user.id);
  return therapist?.id === therapistId;
}

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await rescheduleService.getAll()); } catch (e) { next(e); }
});

router.get("/parent/:id", requireAuth, async (req, res, next) => {
  try {
    if (!(await canAccessParentRequests(req, req.params.id as string))) {
      return res.status(403).json({ success: false, error: "Akses permintaan reschedule ditolak" });
    }
    ok(res, await rescheduleService.getByParent(req.params.id as string));
  } catch (e) { next(e); }
});

router.get("/therapist/:id", requireAuth, async (req, res, next) => {
  try {
    if (!(await canAccessTherapistRequests(req, req.params.id as string))) {
      return res.status(403).json({ success: false, error: "Akses permintaan reschedule ditolak" });
    }
    ok(res, await rescheduleService.getForTherapist(req.params.id as string));
  } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("parent"), async (req, res, next) => {
  try {
    const { parentId, childId, sessionId } = req.body;
    if (!parentId || !childId || !sessionId) return badRequest(res, "Data tidak lengkap");
    const parent = await parentService.getByUserId(req.user!.id);
    if (!parent || (parent.id !== parentId && parent.parentId !== parentId)) {
      return res.status(403).json({ success: false, error: "Akses orang tua tidak sesuai" });
    }
    const child = await childService.getById(childId);
    if (!child || child.parentId !== parent.id) {
      return res.status(403).json({ success: false, error: "Data anak tidak sesuai dengan akun orang tua" });
    }
    const request = await rescheduleService.create({ ...req.body, parentId: parent.id }, req.user);
    created(res, request, "Permintaan reschedule berhasil dikirim");
  } catch (e) {
    next(e);
  }
});

router.post("/preview-slots", requireAuth, requireRole("parent"), async (req, res, next) => {
  try {
    const { childId, sessionId, proposedSlots } = req.body || {};
    if (!childId || !sessionId) return badRequest(res, "Data sesi dan anak wajib diisi");
    const parent = await parentService.getByUserId(req.user!.id);
    if (!parent) return res.status(403).json({ success: false, error: "Akses orang tua tidak sesuai" });
    const child = await childService.getById(childId);
    if (!child || child.parentId !== parent.id) {
      return res.status(403).json({ success: false, error: "Data anak tidak sesuai dengan akun orang tua" });
    }
    ok(res, await rescheduleService.previewSlotsForSession({ childId, sessionId, proposedSlots }));
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/therapist-response", requireAuth, requireRole("therapist"), async (req, res, next) => {
  try {
    const therapist = await therapistService.getByUserId(req.user!.id);
    if (!therapist) return notFound(res, "Profil terapis tidak ditemukan");
    const { decision } = req.body || {};
    if (decision !== "approve" && decision !== "reject") {
      return badRequest(res, "decision harus approve atau reject");
    }
    const result = await rescheduleService.respondAsTherapist(req.params.id as string, therapist.id, req.body, req.user);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { status, ...updates } = req.body;
    const result = await rescheduleService.updateStatus(req.params.id as string, status, updates, req.user);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await rescheduleService.delete(req.params.id as string, req.user);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
