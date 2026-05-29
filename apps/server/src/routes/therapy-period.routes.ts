import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { therapists } from "../db/schema.js";
import { childService } from "../services/child.service.js";
import { parentService } from "../services/parent.service.js";
import { therapistService } from "../services/therapist.service.js";
import { therapyPeriodService } from "../services/therapy-period.service.js";
import { periodDeletionRequestService } from "../services/period-deletion-request.service.js";
import { auditLogService } from "../services/audit-log.service.js";
import { notificationService } from "../services/notification.service.js";
import { created, notFound, ok, badRequest } from "../utils/response.js";

const router = Router();

async function canReadChildPeriods(req: any, childId: string) {
  if (req.user?.role === "admin") return true;
  if (req.user?.role === "parent") {
    const parent = await parentService.getByUserId(req.user.id);
    return !!parent?.children?.some((child: any) => child.id === childId || child.nita === childId);
  }
  if (req.user?.role === "therapist") {
    const [therapist, child] = await Promise.all([
      therapistService.getByUserId(req.user.id),
      childService.getById(childId),
    ]);
    if (!therapist?.id || !child) return false;
    const hasSession = Array.isArray(child.sessions)
      && child.sessions.some((session: any) => session?.therapistId === therapist.id);
    const hasPeriodRule = Array.isArray(child.periods)
      && child.periods.some((period: any) => Array.isArray(period.scheduleRules)
        && period.scheduleRules.some((rule: any) => rule?.therapistId === therapist.id));
    const isAssistant = Array.isArray(child.periods)
      && child.periods.some((period: any) => Array.isArray(period.assistantTherapistIds)
        && period.assistantTherapistIds.includes(therapist.id));
    return hasSession || hasPeriodRule || isAssistant;
  }
  return false;
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

router.get("/deletion-requests", requireAuth, async (req, res, next) => {
  try {
    ok(res, await periodDeletionRequestService.getAllForUser(req.user!));
  } catch (e) { next(e); }
});

router.patch("/deletion-requests/:requestId/respond", requireAuth, async (req, res, next) => {
  try {
    const decision = String(req.body?.decision || "").toLowerCase();
    const note = typeof req.body?.note === "string" ? req.body.note : "";
    const result = await periodDeletionRequestService.respond(req.params.requestId as string, req.user!, decision as any, note);
    if (!result) return notFound(res, "Pengajuan penghapusan periode tidak ditemukan");
    await auditLogService.create({
      actor: req.user,
      action: `therapy_period.deletion_request.${decision}`,
      entityType: "therapy_period_deletion_request",
      entityId: req.params.requestId as string,
      summary: `${req.user!.role} memberi keputusan ${decision} untuk penghapusan periode ${result.periodName}`,
      metadata: { decision, note, status: result.status, periodId: result.periodId },
    });
    ok(res, result, "Keputusan persetujuan tersimpan");
  } catch (e) {
    return badRequest(res, e instanceof Error ? e.message : "Gagal memproses persetujuan");
  }
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
    await auditLogService.create({
      actor: req.user,
      action: "therapy_period.create",
      entityType: "therapy_period",
      entityId: period.id,
      summary: `Periode/program ${period.name} dibuat untuk ${period.child?.name || period.childId}`,
      metadata: { childId: period.childId, programId: period.programId, totalSessions: period.totalSessions },
    });
    created(res, period, "Periode terapi berhasil dibuat");
  } catch (e) {
    return badRequest(res, e instanceof Error ? e.message : "Gagal membuat periode terapi");
  }
});

router.post("/:id/deletion-requests", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
    const request = await periodDeletionRequestService.create(req.params.id as string, req.user!, reason);
    if (!request) return notFound(res, "Periode terapi tidak ditemukan");
    await auditLogService.create({
      actor: req.user,
      action: "therapy_period.deletion_request.create",
      entityType: "therapy_period_deletion_request",
      entityId: request.id,
      summary: `Admin mengajukan penghapusan periode ${request.periodName} untuk ${request.childName}`,
      metadata: { periodId: request.periodId, childId: request.childId, reason: request.reason },
    });
    created(res, request, "Pengajuan penghapusan periode dikirim ke orang tua dan terapis");
  } catch (e) {
    return badRequest(res, e instanceof Error ? e.message : "Gagal mengajukan penghapusan periode");
  }
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const period = await therapyPeriodService.update(req.params.id as string, req.body);
    if (!period) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "therapy_period.update",
      entityType: "therapy_period",
      entityId: period.id,
      summary: `Periode/program ${period.name} diperbarui`,
      metadata: { changedFields: Object.keys(req.body || {}), requested: req.body },
    });
    const therapistIds = Array.from(new Set([
      ...(period.scheduleRules || []).map((rule: any) => rule?.therapistId),
      ...(period.sessions || []).map((session: any) => session?.therapistId),
    ]
      .filter((id: unknown): id is string => typeof id === "string" && !!id)));
    for (const therapistId of therapistIds) {
      const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, therapistId) });
      if (!therapist?.userId) continue;
      await notificationService.create({
        type: "program_change_confirmation",
        icon: "playlist_add_check",
        title: "Perubahan program perlu dicek",
        message: `Admin memperbarui periode ${period.name} untuk ${period.child?.name || period.childId}. Field: ${Object.keys(req.body || {}).join(", ") || "detail program"}.`,
        targetRole: "therapist",
        targetUserId: therapist.userId,
        relatedId: period.id,
      });
    }
    ok(res, period);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await therapyPeriodService.deleteCancelled(req.params.id as string);
    if (!result) return notFound(res, "Periode terapi tidak ditemukan");
    await periodDeletionRequestService.purgeForPeriod(req.params.id as string);
    await auditLogService.create({
      actor: req.user,
      action: "therapy_period.cancelled.delete",
      entityType: "therapy_period",
      entityId: req.params.id as string,
      summary: `Riwayat periode cancelled ${result.name} dihapus permanen`,
      metadata: { childId: result.childId },
    });
    ok(res, result, "Riwayat periode cancelled berhasil dihapus permanen");
  } catch (e) {
    return badRequest(res, e instanceof Error ? e.message : "Gagal menghapus riwayat periode");
  }
});

router.post("/:id/generate-sessions", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await therapyPeriodService.generateSessions(req.params.id as string, req.body || {});
    if (!result) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "therapy_period.generate_sessions",
      entityType: "therapy_period",
      entityId: req.params.id as string,
      summary: `Jadwal sesi periode ${req.params.id} dibuat`,
      metadata: { created: result.created?.length || 0, skipped: result.skipped || [] },
    });
    created(res, result, "Jadwal sesi periode berhasil dibuat");
  } catch (e) {
    return badRequest(res, e instanceof Error ? e.message : "Gagal membuat jadwal sesi periode");
  }
});

router.post("/:id/complete", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const period = await therapyPeriodService.complete(req.params.id as string, req.body || {});
    if (!period) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "therapy_period.complete",
      entityType: "therapy_period",
      entityId: period.id,
      summary: `Periode ${period.name} diselesaikan`,
      metadata: req.body || {},
    });
    ok(res, period, "Periode terapi selesai");
  } catch (e) { next(e); }
});

router.post("/:id/renew", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const period = await therapyPeriodService.renew(req.params.id as string, req.body || {});
    if (!period) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "therapy_period.renew",
      entityType: "therapy_period",
      entityId: period.id,
      summary: `Periode lanjutan ${period.name} dibuat`,
      metadata: { renewalOf: req.params.id, requested: req.body || {} },
    });
    created(res, period, "Periode lanjutan berhasil dibuat");
  } catch (e) {
    return badRequest(res, e instanceof Error ? e.message : "Gagal membuat periode lanjutan");
  }
});

export default router;
