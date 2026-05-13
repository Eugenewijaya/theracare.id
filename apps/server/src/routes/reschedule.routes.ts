import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { auditLogService } from "../services/audit-log.service.js";
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
    const request = await rescheduleService.create({ ...req.body, parentId: parent.id });
    await auditLogService.create({
      actor: req.user,
      action: "reschedule.create",
      entityType: "reschedule_request",
      entityId: request.id,
      summary: `Orang tua mengajukan reschedule sesi ${sessionId}`,
      metadata: { childId, sessionId, proposedSlots: request.proposedSlots || [] },
    });
    created(res, request, "Permintaan reschedule berhasil dikirim");
  } catch (e) {
    return badRequest(res, e instanceof Error ? e.message : "Gagal mengirim permintaan reschedule");
  }
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { status, ...updates } = req.body;
    const result = await rescheduleService.updateStatus(req.params.id as string, status, updates);
    if (!result) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "reschedule.status.update",
      entityType: "reschedule_request",
      entityId: req.params.id as string,
      summary: `Status reschedule diubah menjadi ${status}`,
      metadata: { status, ...updates },
    });
    ok(res, result);
  } catch (e) {
    return badRequest(res, e instanceof Error ? e.message : "Gagal memperbarui permintaan reschedule");
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await rescheduleService.delete(req.params.id as string);
    if (!result) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "reschedule.delete",
      entityType: "reschedule_request",
      entityId: req.params.id as string,
      summary: `Permintaan reschedule ${req.params.id} dihapus`,
      metadata: {},
    });
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
