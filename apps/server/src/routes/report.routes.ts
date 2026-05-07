import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { reportService } from "../services/report.service.js";
import { ok, created, notFound } from "../utils/response.js";

const router = Router();

router.get("/therapist/:id", requireAuth, async (req, res, next) => {
  try { ok(res, await reportService.getForTherapist(req.params.id as string, req.query.type as string as string)); } catch (e) { next(e); }
});

router.get("/child/:id", requireAuth, async (req, res, next) => {
  try { ok(res, await reportService.getForChild(req.params.id as string, req.query.type as string as string)); } catch (e) { next(e); }
});

router.get("/session/:id", requireAuth, async (req, res, next) => {
  try { ok(res, await reportService.getSessionReport(req.params.id as string)); } catch (e) { next(e); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const report = await reportService.getById(req.params.id as string);
    if (!report) return notFound(res);
    ok(res, report);
  } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("therapist"), async (req, res, next) => {
  try { created(res, await reportService.save(req.body), "Laporan berhasil disimpan"); } catch (e) { next(e); }
});

router.patch("/:id/status", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await reportService.updateStatus(req.params.id as string, req.body.status);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

router.patch("/:id", requireAuth, requireRole("therapist", "admin"), async (req, res, next) => {
  try {
    const result = await reportService.update(req.params.id as string, req.body);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await reportService.delete(req.params.id as string);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
