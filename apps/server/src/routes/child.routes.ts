import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { childService } from "../services/child.service.js";
import { ok, created, notFound, badRequest } from "../utils/response.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await childService.getAll()); } catch (e) { next(e); }
});

router.get("/by-parent/:parentId", requireAuth, async (req, res, next) => {
  try { ok(res, await childService.getByParent(req.params.parentId as string)); } catch (e) { next(e); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const child = await childService.getById(req.params.id as string);
    if (!child) return notFound(res);
    ok(res, child);
  } catch (e) { next(e); }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { parentId, firstName, lastName, ...rest } = req.body;
    if (!parentId || !firstName || !lastName) return badRequest(res, "parentId, firstName, dan lastName wajib diisi");
    const child = await childService.create(parentId, { firstName, lastName, ...rest });
    created(res, child, "Anak berhasil didaftarkan");
  } catch (e) { next(e); }
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const updated = await childService.update(req.params.id as string, req.body);
    if (!updated) return notFound(res);
    ok(res, updated);
  } catch (e) { next(e); }
});

export default router;
