import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { syncService } from "../services/sync.service.js";
import { ok } from "../utils/response.js";

const router = Router();

router.get("/version", requireAuth, async (_req, res, next) => {
  try {
    ok(res, await syncService.getVersion());
  } catch (e) {
    next(e);
  }
});

export default router;
