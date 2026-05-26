import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { migrationService } from "../services/migration.service.js";
import { HttpError } from "../utils/http-error.js";
import { badRequest, created, notFound, ok } from "../utils/response.js";

const router = Router();

function handleMigrationError(res: any, error: unknown, fallback: string) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ success: false, error: error.message, details: error.details });
  }
  return badRequest(res, error instanceof Error ? error.message : fallback);
}

router.post("/batches/dry-run", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    created(res, await migrationService.dryRun(req.body || {}, req.user), "Dry-run migrasi berhasil dibuat");
  } catch (error) {
    return handleMigrationError(res, error, "Gagal membuat dry-run migrasi");
  }
});

router.get("/batches/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const batch = await migrationService.getBatch(req.params.id as string);
    if (!batch) return notFound(res, "Batch migrasi tidak ditemukan");
    ok(res, batch);
  } catch (error) {
    next(error);
  }
});

router.post("/batches/:id/apply", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const batch = await migrationService.applyBatch(req.params.id as string, req.user);
    if (!batch) return notFound(res, "Batch migrasi tidak ditemukan");
    ok(res, batch, "Batch migrasi diterapkan");
  } catch (error) {
    return handleMigrationError(res, error, "Gagal menerapkan batch migrasi");
  }
});

router.post("/manual-intake", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    created(res, await migrationService.manualIntake(req.body || {}, req.user), "Intake manual berhasil diterapkan");
  } catch (error) {
    return handleMigrationError(res, error, "Gagal menerapkan intake manual");
  }
});

export default router;
