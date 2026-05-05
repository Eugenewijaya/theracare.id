import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { sessionService } from "../services/session.service.js";
import { ok, created, notFound, badRequest } from "../utils/response.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await sessionService.getAllWithDetails()); } catch (e) { next(e); }
});

router.get("/therapist/:id", requireAuth, async (req, res, next) => {
  try { ok(res, await sessionService.getForTherapist(req.params.id as string, req.query.date as string as string)); } catch (e) { next(e); }
});

router.get("/child/:id/upcoming", requireAuth, async (req, res, next) => {
  try { ok(res, await sessionService.getUpcomingForChild(req.params.id as string)); } catch (e) { next(e); }
});

router.get("/child/:id/completed", requireAuth, async (req, res, next) => {
  try { ok(res, await sessionService.getCompletedForChild(req.params.id as string)); } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { therapistId, childId, date, startTime } = req.body;
    if (!therapistId || !childId || !date || !startTime) return badRequest(res, "Data sesi tidak lengkap");
    created(res, await sessionService.create(req.body), "Sesi berhasil dibuat");
  } catch (e) { next(e); }
});

router.post("/bulk", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    if (!Array.isArray(req.body.sessions)) return badRequest(res, "Format data tidak valid");
    created(res, await sessionService.createBulk(req.body.sessions), "Jadwal massal berhasil dibuat");
  } catch (e) { next(e); }
});

router.patch("/:id/status", requireAuth, async (req, res, next) => {
  try {
    const result = await sessionService.updateStatus(req.params.id as string, req.body.status, req.body.cancelReason);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

router.patch("/:id/notes", requireAuth, async (req, res, next) => {
  try {
    const result = await sessionService.saveNotes(req.params.id as string, req.body.notes);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

// ── Ratings ──
router.get("/:id/rating", requireAuth, async (req, res, next) => {
  try { ok(res, await sessionService.getRating(req.params.id as string)); } catch (e) { next(e); }
});

router.post("/:id/rating", requireAuth, requireRole("parent"), async (req, res, next) => {
  try {
    created(res, await sessionService.addRating({ sessionId: req.params.id as string, ...req.body }));
  } catch (e) { next(e); }
});

export default router;
