import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { locationSignalService } from "../services/location-signal.service.js";
import { getRequestClientMeta } from "../utils/request-context.js";
import { ok, badRequest } from "../utils/response.js";

const router = Router();

router.post("/signal", requireAuth, async (req, res, next) => {
  try {
    const signal = await locationSignalService.record(req.user!, req.body || {}, getRequestClientMeta(req));
    ok(res, signal, "Sinyal lokasi tersimpan");
  } catch (e) {
    return badRequest(res, e instanceof Error ? e.message : "Gagal menyimpan sinyal lokasi");
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    ok(res, await locationSignalService.getForUser(req.user!.id));
  } catch (e) { next(e); }
});

export default router;
