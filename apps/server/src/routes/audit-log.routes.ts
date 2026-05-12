import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { auditLogService } from "../services/audit-log.service.js";
import { ok } from "../utils/response.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    ok(res, await auditLogService.getAll({
      entityType: req.query.entityType as string | undefined,
      entityId: req.query.entityId as string | undefined,
    }));
  } catch (e) {
    next(e);
  }
});

export default router;
