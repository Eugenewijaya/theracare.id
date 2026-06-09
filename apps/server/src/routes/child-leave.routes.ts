import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { auditLogService } from "../services/audit-log.service.js";
import { childLeaveService } from "../services/child-leave.service.js";
import { badRequest, created, ok } from "../utils/response.js";

const router = Router();

function routeError(res: any, next: any, error: unknown, fallback: string) {
  if (error && typeof error === "object" && "status" in error) return next(error);
  return badRequest(res, error instanceof Error ? error.message : fallback);
}

router.get("/", requireAuth, requireRole("admin"), async (_req, res, next) => {
  try {
    ok(res, await childLeaveService.getAll());
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const request = await childLeaveService.create(req.body || {}, req.user!.id);
    await auditLogService.create({
      actor: req.user,
      action: "child_leave.create",
      entityType: "child_leave",
      entityId: request.id,
      summary: `Draft cuti ${request.childName} dibuat untuk ${request.startDate} sampai ${request.endDate}`,
      metadata: { childId: request.childId, therapyPeriodId: request.therapyPeriodId, impactedSessions: request.impacts.length },
    });
    created(res, request, "Draft cuti anak berhasil dibuat");
  } catch (error) {
    routeError(res, next, error, "Gagal membuat draft cuti anak");
  }
});

router.post("/:id/confirm", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const request = await childLeaveService.confirm(req.params.id as string, req.body || {}, req.user!.id);
    await auditLogService.create({
      actor: req.user,
      action: "child_leave.confirm",
      entityType: "child_leave",
      entityId: req.params.id as string,
      summary: `Cuti anak ${request?.childName || req.params.id} dikonfirmasi dan jadwal dipindahkan`,
      metadata: { communicationChannel: req.body?.communicationChannel, impacts: request?.impacts?.length || 0 },
    });
    ok(res, request, "Cuti dikonfirmasi dan sesi terdampak diproses");
  } catch (error) {
    routeError(res, next, error, "Gagal mengonfirmasi cuti anak");
  }
});

router.patch("/:id/revise", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const request = await childLeaveService.revise(req.params.id as string, req.body || {}, req.user!.id);
    await auditLogService.create({
      actor: req.user,
      action: "child_leave.revise",
      entityType: "child_leave",
      entityId: req.params.id as string,
      summary: `Periode cuti ${request?.childName || req.params.id} diperbarui`,
      metadata: {
        startDate: request?.startDate,
        endDate: request?.endDate,
        strategy: req.body?.strategy || "restore_original",
        communicationChannel: req.body?.communicationChannel,
      },
    });
    ok(res, request, "Perubahan cuti dan jadwal berhasil diproses");
  } catch (error) {
    routeError(res, next, error, "Gagal memperbarui cuti anak");
  }
});

router.post("/:id/cancel", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const request = await childLeaveService.cancel(req.params.id as string, req.body || {}, req.user!.id);
    await auditLogService.create({
      actor: req.user,
      action: "child_leave.cancel",
      entityType: "child_leave",
      entityId: req.params.id as string,
      summary: `Cuti anak ${request?.childName || req.params.id} dibatalkan dan jadwal asal dicoba dipulihkan`,
      metadata: { communicationChannel: req.body?.communicationChannel },
    });
    ok(res, request, "Cuti dibatalkan dan jadwal asal yang tersedia dipulihkan");
  } catch (error) {
    routeError(res, next, error, "Gagal membatalkan cuti anak");
  }
});

router.post("/:id/retry", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const request = await childLeaveService.retryFailed(req.params.id as string);
    await auditLogService.create({
      actor: req.user,
      action: "child_leave.retry",
      entityType: "child_leave",
      entityId: req.params.id as string,
      summary: `Pemindahan sesi cuti ${request?.childName || req.params.id} dicoba ulang`,
      metadata: { failed: request?.impacts?.filter((impact) => impact.status === "move_failed").length || 0 },
    });
    ok(res, request, "Pemindahan sesi dicoba ulang");
  } catch (error) {
    routeError(res, next, error, "Gagal mencoba ulang pemindahan sesi");
  }
});

export default router;
