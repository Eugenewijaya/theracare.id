import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { parentService } from "../services/parent.service.js";
import { therapyPeriodService } from "../services/therapy-period.service.js";
import { created, notFound, ok, badRequest } from "../utils/response.js";

const router = Router();

async function canReadChildPeriods(req: any, childId: string) {
  if (req.user?.role === "admin" || req.user?.role === "therapist") return true;
  if (req.user?.role !== "parent") return false;
  const parent = await parentService.getByUserId(req.user.id);
  return !!parent?.children?.some((child: any) => child.id === childId || child.nita === childId);
}

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    ok(res, await therapyPeriodService.getAll({
      childId: req.query.childId as string | undefined,
      status: req.query.status as string | undefined,
    }));
  } catch (e) { next(e); }
});

router.get("/child/:childId", requireAuth, async (req, res, next) => {
  try {
    if (!(await canReadChildPeriods(req, req.params.childId as string))) {
      return res.status(403).json({ success: false, error: "Akses ditolak" });
    }
    ok(res, await therapyPeriodService.getAll({ childId: req.params.childId as string }));
  } catch (e) { next(e); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const period = await therapyPeriodService.getById(req.params.id as string);
    if (!period) return notFound(res);
    if (!(await canReadChildPeriods(req, period.childId))) {
      return res.status(403).json({ success: false, error: "Akses ditolak" });
    }
    ok(res, period);
  } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    if (!req.body?.childId) return badRequest(res, "childId wajib diisi");
    const period = await therapyPeriodService.create(req.body);
    if (!period) return notFound(res, "Anak tidak ditemukan");
    created(res, period, "Periode terapi berhasil dibuat");
  } catch (e) {
    return badRequest(res, e instanceof Error ? e.message : "Gagal membuat periode terapi");
  }
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const period = await therapyPeriodService.update(req.params.id as string, req.body);
    if (!period) return notFound(res);
    ok(res, period);
  } catch (e) { next(e); }
});

router.post("/:id/generate-sessions", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await therapyPeriodService.generateSessions(req.params.id as string, req.body || {});
    if (!result) return notFound(res);
    created(res, result, "Jadwal sesi periode berhasil dibuat");
  } catch (e) {
    return badRequest(res, e instanceof Error ? e.message : "Gagal membuat jadwal sesi periode");
  }
});

router.post("/:id/complete", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const period = await therapyPeriodService.complete(req.params.id as string, req.body || {});
    if (!period) return notFound(res);
    ok(res, period, "Periode terapi selesai");
  } catch (e) { next(e); }
});

router.post("/:id/renew", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const period = await therapyPeriodService.renew(req.params.id as string, req.body || {});
    if (!period) return notFound(res);
    created(res, period, "Periode lanjutan berhasil dibuat");
  } catch (e) {
    return badRequest(res, e instanceof Error ? e.message : "Gagal membuat periode lanjutan");
  }
});

export default router;
