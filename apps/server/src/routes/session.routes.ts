import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { sessionService } from "../services/session.service.js";
import { therapistService } from "../services/therapist.service.js";
import { ok, created, notFound, badRequest, conflict } from "../utils/response.js";

const router = Router();

async function canAccessTherapistSchedule(req: any, therapistId: string) {
  if (req.user?.role === "admin") return true;
  if (req.user?.role !== "therapist") return false;
  const ownProfile = await therapistService.getByUserId(req.user.id);
  return ownProfile?.id === therapistId;
}

async function canMutateSession(req: any, sessionId: string) {
  if (req.user?.role === "admin") return { allowed: true, session: null };
  if (req.user?.role !== "therapist") return { allowed: false, session: null };
  const [ownProfile, session] = await Promise.all([
    therapistService.getByUserId(req.user.id),
    sessionService.getById(sessionId),
  ]);
  if (!session) return { allowed: true, session: null };
  return { allowed: ownProfile?.id === session.therapistId, session };
}

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await sessionService.getAllWithDetails()); } catch (e) { next(e); }
});

router.get("/therapist/:id", requireAuth, async (req, res, next) => {
  try {
    if (!(await canAccessTherapistSchedule(req, req.params.id as string))) {
      return res.status(403).json({ success: false, error: "Akses ditolak" });
    }
    ok(res, await sessionService.getForTherapist(req.params.id as string, req.query.date as string as string));
  } catch (e) { next(e); }
});

router.get("/child/:id/upcoming", requireAuth, async (req, res, next) => {
  try { ok(res, await sessionService.getUpcomingForChild(req.params.id as string)); } catch (e) { next(e); }
});

router.get("/child/:id/completed", requireAuth, async (req, res, next) => {
  try { ok(res, await sessionService.getCompletedForChild(req.params.id as string)); } catch (e) { next(e); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const session = await sessionService.getById(req.params.id as string);
    if (!session) return notFound(res);
    ok(res, session);
  } catch (e) { next(e); }
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
    const access = await canMutateSession(req, req.params.id as string);
    if (!access.allowed) return res.status(403).json({ success: false, error: "Akses ditolak" });
    if (access.session === null && req.user!.role !== "admin") return notFound(res);
    const result = await sessionService.updateStatus(req.params.id as string, req.body.status, req.body.cancelReason);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

router.patch("/:id/notes", requireAuth, async (req, res, next) => {
  try {
    const access = await canMutateSession(req, req.params.id as string);
    if (!access.allowed) return res.status(403).json({ success: false, error: "Akses ditolak" });
    if (access.session === null && req.user!.role !== "admin") return notFound(res);
    const result = await sessionService.saveNotes(req.params.id as string, req.body.notes);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await sessionService.update(req.params.id as string, req.body);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await sessionService.delete(req.params.id as string);
    if (!result) return notFound(res);
    if ("blocked" in result && result.blocked) return conflict(res, result.reason, result);
    ok(res, result);
  } catch (e) { next(e); }
});

// ── Ratings ──
router.get("/:id/rating", requireAuth, async (req, res, next) => {
  try { ok(res, await sessionService.getRating(req.params.id as string)); } catch (e) { next(e); }
});

router.post("/:id/rating", requireAuth, requireRole("parent"), async (req, res, next) => {
  try {
    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return badRequest(res, "Rating harus bernilai 1 sampai 5");
    }
    created(res, await sessionService.addRating({ sessionId: req.params.id as string, ...req.body }));
  } catch (e) { next(e); }
});

export default router;
