import { Router } from "express";
import type { Request } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { reportService } from "../services/report.service.js";
import { therapistService } from "../services/therapist.service.js";
import { ok, created, notFound } from "../utils/response.js";
import { isParentVisibleReportStatus } from "../domain/workflow-status.js";

const router = Router();

async function getOwnTherapistId(req: Request) {
  if (req.user?.role !== "therapist") return null;
  const profile = await therapistService.getByUserId(req.user.id);
  return profile?.id || null;
}

async function canReadReport(req: Request, report: any) {
  if (req.user?.role === "admin") return true;
  if (req.user?.role === "parent") {
    const allowed = await reportService.canParentAccessChild(req.user.id, report.childId);
    return allowed && isParentVisibleReportStatus(report.status);
  }
  if (req.user?.role === "therapist") {
    const therapistId = await getOwnTherapistId(req);
    return therapistId === report.therapistId;
  }
  return false;
}

router.get("/therapist/:id", requireAuth, async (req, res, next) => {
  try {
    if (req.user?.role !== "admin") {
      const therapistId = await getOwnTherapistId(req);
      if (!therapistId || therapistId !== req.params.id) {
        return res.status(403).json({ error: "Akses laporan terapis ditolak" });
      }
    }
    ok(res, await reportService.getForTherapist(req.params.id as string, req.query.type as string as string));
  } catch (e) { next(e); }
});

router.get("/child/:id", requireAuth, async (req, res, next) => {
  try {
    const options: { visibleToParentOnly?: boolean; therapistId?: string } = {};
    if (req.user?.role === "parent") {
      const allowed = await reportService.canParentAccessChild(req.user.id, req.params.id as string);
      if (!allowed) return res.status(403).json({ error: "Akses laporan anak ditolak" });
      options.visibleToParentOnly = true;
    } else if (req.user?.role === "therapist") {
      const therapistId = await getOwnTherapistId(req);
      if (!therapistId) return res.status(403).json({ error: "Akses laporan anak ditolak" });
      options.therapistId = therapistId;
    } else if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Akses laporan anak ditolak" });
    }
    ok(res, await reportService.getForChild(req.params.id as string, req.query.type as string as string, options));
  } catch (e) { next(e); }
});

router.get("/session/:id", requireAuth, async (req, res, next) => {
  try {
    const report = await reportService.getSessionReport(req.params.id as string);
    if (!report) return notFound(res);
    if (!await canReadReport(req, report)) {
      return res.status(403).json({ error: "Akses laporan sesi ditolak" });
    }
    ok(res, report);
  } catch (e) { next(e); }
});

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await reportService.getAll(req.query.status as string)); } catch (e) { next(e); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const report = await reportService.getById(req.params.id as string);
    if (!report) return notFound(res);
    if (!await canReadReport(req, report)) {
      return res.status(403).json({ error: "Akses laporan anak ditolak" });
    }
    ok(res, report);
  } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("therapist"), async (req, res, next) => {
  try {
    const therapistId = await getOwnTherapistId(req);
    if (!therapistId) return res.status(403).json({ error: "Akses simpan laporan ditolak" });
    const report = await reportService.save({ ...req.body, therapistId }, req.user);
    if (!report) return notFound(res);
    created(res, report, "Laporan berhasil disimpan");
  } catch (e) { next(e); }
});

router.patch("/:id/status", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await reportService.updateStatus(
      req.params.id as string,
      req.body.status,
      req.body.reviewNote,
      req.user?.role,
      req.user,
    );
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

router.patch("/:id", requireAuth, requireRole("therapist", "admin"), async (req, res, next) => {
  try {
    if (req.user?.role === "therapist") {
      const report = await reportService.getById(req.params.id as string);
      if (!report) return notFound(res);
      const therapistId = await getOwnTherapistId(req);
      if (!therapistId || therapistId !== report.therapistId) {
        return res.status(403).json({ error: "Akses ubah laporan ditolak" });
      }
    }
    const result = await reportService.update(req.params.id as string, req.body, {
      allowStatus: req.user?.role === "admin",
      actor: req.user,
    });
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await reportService.delete(req.params.id as string, req.user);
    if (!result) return notFound(res);
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
