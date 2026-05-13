import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { childService } from "../services/child.service.js";
import { auditLogService } from "../services/audit-log.service.js";
import { meetingService } from "../services/meeting.service.js";
import { ok, created, notFound, badRequest } from "../utils/response.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (_req, res, next) => {
  try { ok(res, await meetingService.getAll()); } catch (e) { next(e); }
});

router.get("/therapist/me", requireAuth, requireRole("therapist"), async (req, res, next) => {
  try {
    const therapist = await meetingService.getTherapistByUserId(req.user!.id);
    if (!therapist) return notFound(res, "Profil terapis tidak ditemukan");
    ok(res, await meetingService.getForTherapist(therapist.id));
  } catch (e) { next(e); }
});

router.get("/parent/me", requireAuth, requireRole("parent"), async (req, res, next) => {
  try {
    const parent = await meetingService.getParentByUserId(req.user!.id);
    if (!parent) return notFound(res, "Profil orang tua tidak ditemukan");
    ok(res, await meetingService.getForParent(parent.id));
  } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("admin", "therapist"), async (req, res, next) => {
  try {
    const { childId, date, time } = req.body || {};
    if (!childId || !date || !time) return badRequest(res, "childId, date, dan time wajib diisi");
    if (req.user!.role === "admin" && !req.body.parentContactConfirmed) {
      return badRequest(res, "Admin wajib mengonfirmasi orang tua sudah dihubungi dan menyetujui jadwal.");
    }
    if (req.user!.role === "therapist") {
      const therapist = await meetingService.getTherapistByUserId(req.user!.id);
      if (!therapist) return notFound(res, "Profil terapis tidak ditemukan");
      const child = await childService.getById(childId);
      const isRelatedChild = Array.isArray(child?.sessions)
        && child.sessions.some((session: any) => session?.therapistId === therapist.id);
      if (!isRelatedChild) {
        return res.status(403).json({ success: false, error: "Terapis hanya bisa mengajukan meeting untuk anak yang ditangani." });
      }
    }
    const meeting = await meetingService.create(req.body, { id: req.user!.id, role: req.user!.role });
    if (!meeting) return badRequest(res, "Data anak atau terapis tidak valid");
    await auditLogService.create({
      actor: req.user,
      action: "parent_meeting.create",
      entityType: "parent_meeting",
      entityId: meeting.id,
      summary: `Parent meeting ${meeting.id} dibuat`,
      metadata: { childId, date, time, requestedByRole: req.user!.role },
    });
    created(res, meeting, "Parent meeting berhasil diajukan");
  } catch (e) { next(e); }
});

router.patch("/:id/admin-review", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const status = req.body?.status || "approved_by_admin";
    if (status === "approved_by_admin" && !req.body?.parentContactConfirmed) {
      return badRequest(res, "Konfirmasi bahwa orang tua sudah dihubungi dan setuju sebelum approve.");
    }
    const meeting = await meetingService.adminReview(req.params.id as string, req.body, req.user!.id);
    if (!meeting) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "parent_meeting.admin_review",
      entityType: "parent_meeting",
      entityId: req.params.id as string,
      summary: `Parent meeting ${req.params.id} direview admin`,
      metadata: { status: meeting.status, parentContactConfirmed: Boolean(req.body?.parentContactConfirmed) },
    });
    ok(res, meeting, "Parent meeting berhasil direview");
  } catch (e) { next(e); }
});

router.patch("/:id/parent-response", requireAuth, requireRole("parent"), async (req, res, next) => {
  try {
    const parent = await meetingService.getParentByUserId(req.user!.id);
    if (!parent) return notFound(res, "Profil orang tua tidak ditemukan");
    const status = req.body?.status === "parent_declined" ? "parent_declined" : "parent_confirmed";
    const meeting = await meetingService.parentResponse(req.params.id as string, parent.id, status, req.body?.note);
    if (!meeting) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "parent_meeting.parent_response",
      entityType: "parent_meeting",
      entityId: req.params.id as string,
      summary: `Orang tua merespons parent meeting ${req.params.id}`,
      metadata: { status, note: req.body?.note || "" },
    });
    ok(res, meeting, "Respons parent meeting tersimpan");
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await meetingService.delete(req.params.id as string);
    if (!result) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "parent_meeting.delete",
      entityType: "parent_meeting",
      entityId: req.params.id as string,
      summary: `Parent meeting ${req.params.id} dihapus`,
      metadata: {},
    });
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
