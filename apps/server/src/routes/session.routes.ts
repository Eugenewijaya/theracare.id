import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { childService } from "../services/child.service.js";
import { parentService } from "../services/parent.service.js";
import { sessionService } from "../services/session.service.js";
import { therapistService } from "../services/therapist.service.js";
import { auditLogService } from "../services/audit-log.service.js";
import { notificationService } from "../services/notification.service.js";
import { ok, created, notFound, badRequest, conflict } from "../utils/response.js";
import { isAttendanceConfirmedSessionStatus } from "../domain/workflow-status.js";

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

async function canAccessChildSchedule(req: any, childId: string) {
  if (req.user?.role === "admin") return true;
  const child = await childService.getById(childId);
  if (!child) return false;
  if (req.user?.role === "parent") return child.parent?.userId === req.user.id;
  if (req.user?.role === "therapist") {
    const ownProfile = await therapistService.getByUserId(req.user.id);
    return Boolean(
      ownProfile?.id
        && Array.isArray(child.sessions)
        && child.sessions.some((session: any) => session?.therapistId === ownProfile.id),
    ) || Boolean(
      ownProfile?.id
        && Array.isArray(child.periods)
        && child.periods.some((period: any) => (
          (Array.isArray(period?.scheduleRules) && period.scheduleRules.some((rule: any) => rule?.therapistId === ownProfile.id))
          || (Array.isArray(period?.assistantTherapistIds) && period.assistantTherapistIds.includes(ownProfile.id))
        )),
    );
  }
  return false;
}

async function canAccessSession(req: any, session: any) {
  if (req.user?.role === "admin") return true;
  if (req.user?.role === "parent") return session?.child?.parent?.userId === req.user.id;
  if (req.user?.role === "therapist") {
    const ownProfile = await therapistService.getByUserId(req.user.id);
    return ownProfile?.id === session?.therapistId;
  }
  return false;
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
  try {
    if (!(await canAccessChildSchedule(req, req.params.id as string))) {
      return res.status(403).json({ success: false, error: "Akses ditolak" });
    }
    ok(res, await sessionService.getUpcomingForChild(req.params.id as string));
  } catch (e) { next(e); }
});

router.get("/child/:id/completed", requireAuth, async (req, res, next) => {
  try {
    if (!(await canAccessChildSchedule(req, req.params.id as string))) {
      return res.status(403).json({ success: false, error: "Akses ditolak" });
    }
    ok(res, await sessionService.getCompletedForChild(req.params.id as string));
  } catch (e) { next(e); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const session = await sessionService.getById(req.params.id as string);
    if (!session) return notFound(res);
    if (!(await canAccessSession(req, session))) {
      return res.status(403).json({ success: false, error: "Akses ditolak" });
    }
    ok(res, session);
  } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { therapistId, childId, date, startTime } = req.body;
    if (!therapistId || !childId || !date || !startTime) return badRequest(res, "Data sesi tidak lengkap");
    const session = await sessionService.create(req.body);
    await auditLogService.create({
      actor: req.user,
      action: "session.create",
      entityType: "session",
      entityId: session.id,
      summary: `Sesi dibuat untuk ${childId} pada ${date} ${startTime}`,
      metadata: req.body,
    });
    created(res, session, "Sesi berhasil dibuat");
  } catch (e) { next(e); }
});

router.post("/bulk", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    if (!Array.isArray(req.body.sessions)) return badRequest(res, "Format data tidak valid");
    const sessions = await sessionService.createBulk(req.body.sessions);
    await auditLogService.create({
      actor: req.user,
      action: "session.bulk_create",
      entityType: "session",
      summary: `${sessions.length} jadwal massal dibuat`,
      metadata: { count: sessions.length },
    });
    created(res, sessions, "Jadwal massal berhasil dibuat");
  } catch (e) { next(e); }
});

router.patch("/:id/status", requireAuth, async (req, res, next) => {
  try {
    const access = await canMutateSession(req, req.params.id as string);
    if (!access.allowed) return res.status(403).json({ success: false, error: "Akses ditolak" });
    if (access.session === null && req.user!.role !== "admin") return notFound(res);
    const nextStatus = String(req.body?.status || "").trim();
    if (!nextStatus) return badRequest(res, "Status sesi wajib diisi");
    if (req.user?.role === "therapist" && nextStatus === "active") {
      const currentStatus = access.session?.status;
      if (currentStatus !== "active" && !isAttendanceConfirmedSessionStatus(currentStatus)) {
        return conflict(res, "Sesi belum bisa dimulai karena kehadiran anak belum dikonfirmasi admin.", {
          currentStatus,
          requiredStatus: "confirmed",
        });
      }
    }
    if (req.user?.role === "therapist" && nextStatus === "done" && access.session?.status !== "active") {
      return conflict(res, "Sesi hanya bisa diakhiri setelah statusnya berjalan.", {
        currentStatus: access.session?.status,
        requiredStatus: "active",
      });
    }
    const result = await sessionService.updateStatus(req.params.id as string, nextStatus, req.body.cancelReason);
    if (!result) return notFound(res);
    await auditLogService.create({
      actor: req.user,
      action: "session.status.update",
      entityType: "session",
      entityId: req.params.id as string,
      summary: `Status sesi diubah menjadi ${nextStatus}`,
      metadata: { status: nextStatus, cancelReason: req.body.cancelReason },
    });
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
    const before = await sessionService.getById(req.params.id as string);
    if (!before) return notFound(res);
    const sensitiveFields = ["therapistId", "childId", "roomId", "date", "startTime", "duration", "focus"];
    const changedFields = sensitiveFields.filter((field) => (
      Object.prototype.hasOwnProperty.call(req.body || {}, field)
      && String(req.body?.[field] ?? "") !== String((before as any)?.[field] ?? "")
    ));
    if (changedFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Perubahan jadwal/program sensitif harus melalui alur konfirmasi terapis utama terlebih dahulu.",
        data: { changedFields },
      });
    }
    const result = await sessionService.update(req.params.id as string, req.body);
    if (!result) return notFound(res);
    const after = await sessionService.getById(req.params.id as string);
    await auditLogService.create({
      actor: req.user,
      action: "session.update",
      entityType: "session",
      entityId: req.params.id as string,
      summary: `Sesi ${req.params.id} diperbarui`,
      metadata: { changedFields, before: before ? { therapistId: before.therapistId, date: before.date, startTime: before.startTime, focus: before.focus } : null, requested: req.body },
    });
    if (before?.therapist?.userId && changedFields.length > 0) {
      await notificationService.create({
        type: "schedule_change_confirmation",
        icon: "rule",
        title: "Perubahan jadwal perlu dicek",
        message: `Admin mengubah sesi ${before.child?.name || before.childId} pada ${before.date} ${before.startTime}. Perubahan: ${changedFields.join(", ")}. Silakan cek pembaruan jadwal dan beri respons jika tidak sesuai.`,
        targetRole: "therapist",
        targetUserId: before.therapist.userId,
        relatedId: req.params.id as string,
      });
    }
    ok(res, after || result);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await sessionService.delete(req.params.id as string);
    if (!result) return notFound(res);
    if ("blocked" in result && result.blocked) return conflict(res, result.reason, result);
    await auditLogService.create({
      actor: req.user,
      action: "session.delete",
      entityType: "session",
      entityId: req.params.id as string,
      summary: `Sesi ${req.params.id} dihapus`,
      metadata: {},
    });
    ok(res, result);
  } catch (e) { next(e); }
});

// ── Ratings ──
router.get("/:id/rating", requireAuth, async (req, res, next) => {
  try {
    const session = await sessionService.getById(req.params.id as string);
    if (!session) return notFound(res);
    if (!(await canAccessSession(req, session))) {
      return res.status(403).json({ success: false, error: "Akses ditolak" });
    }
    ok(res, await sessionService.getRating(req.params.id as string));
  } catch (e) { next(e); }
});

router.post("/:id/rating", requireAuth, requireRole("parent"), async (req, res, next) => {
  try {
    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return badRequest(res, "Rating harus bernilai 1 sampai 5");
    }
    const session = await sessionService.getById(req.params.id as string);
    if (!session) return notFound(res);
    if (!(await canAccessSession(req, session))) {
      return res.status(403).json({ success: false, error: "Akses ditolak" });
    }

    const parentProfile = await parentService.getByUserId(req.user!.id);
    if (!parentProfile) return res.status(403).json({ success: false, error: "Akun orang tua tidak ditemukan" });

    const savedRating = await sessionService.addRating({
      sessionId: req.params.id as string,
      childId: session.childId,
      parentId: parentProfile.id,
      rating,
      comment: typeof req.body?.comment === "string" ? req.body.comment : null,
    });
    await auditLogService.create({
      actor: req.user,
      action: "session.rating.upsert",
      entityType: "session_rating",
      entityId: savedRating.id,
      summary: `Rating sesi ${req.params.id} disimpan oleh orang tua`,
      metadata: { sessionId: req.params.id as string, childId: session.childId, rating },
    });
    created(res, savedRating);
  } catch (e) { next(e); }
});

export default router;
