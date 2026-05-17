import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { childService } from "../services/child.service.js";
import { parentService } from "../services/parent.service.js";
import { ok, created, notFound, badRequest, conflict } from "../utils/response.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try { ok(res, await childService.getAll()); } catch (e) { next(e); }
});

router.get("/by-parent/:parentId", requireAuth, async (req, res, next) => {
  try {
    if (req.user?.role === "parent") {
      const parent = await parentService.getByUserId(req.user.id);
      if (!parent || parent.id !== req.params.parentId) {
        return res.status(403).json({ success: false, error: "Akses data anak ditolak" });
      }
    }
    ok(res, await childService.getByParent(req.params.parentId as string));
  } catch (e) { next(e); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const child = await childService.getById(req.params.id as string);
    if (!child) return notFound(res);
    if (req.user?.role === "parent" && child.parent?.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: "Akses data anak ditolak" });
    }
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

router.patch("/:id/photo", requireAuth, async (req, res, next) => {
  try {
    const { photoUrl } = req.body || {};
    if (!photoUrl || typeof photoUrl !== "string") return badRequest(res, "photoUrl wajib diisi");
    const existing = await childService.getById(req.params.id as string);
    if (!existing) return notFound(res);
    if (req.user?.role === "parent" && existing.parent?.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: "Akses ditolak - anak tidak terhubung ke akun orang tua ini" });
    }
    const updated = await childService.updatePhoto(req.params.id as string, photoUrl);
    if (!updated) return notFound(res);
    ok(res, updated, "Foto anak berhasil diperbarui");
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await childService.delete(req.params.id as string);
    if (!result) return notFound(res);
    if ("blocked" in result && result.blocked) return conflict(res, result.reason, result);
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
