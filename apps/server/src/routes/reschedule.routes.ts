import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { rescheduleService } from "../services/reschedule.service.js";
import { ok, created, notFound, badRequest } from "../utils/response.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await rescheduleService.getAll()); } catch (e) { next(e); }
});

router.get("/parent/:id", requireAuth, async (req, res, next) => {
  try { ok(res, await rescheduleService.getByParent(req.params.id)); } catch (e) { next(e); }
});

router.get("/therapist/:id", requireAuth, async (req, res, next) => {
  try { ok(res, await rescheduleService.getForTherapist(req.params.id)); } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("parent"), async (req, res, next) => {
  try {
    const { parentId, childId, sessionId } = req.body;
    if (!parentId || !childId || !sessionId) return badRequest(res, "Data tidak lengkap");
    created(res, await rescheduleService.create(req.body), "Permintaan reschedule berhasil dikirim");
  } catch (e) { next(e); }
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { status, ...updates } = req.body;
    const result = await rescheduleService.updateStatus(req.params.id, status, updates);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
