import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { storageService } from "../services/storage.service.js";
import { badRequest, created } from "../utils/response.js";

const router = Router();

router.post("/image", requireAuth, async (req, res) => {
  try {
    const { kind, fileName, contentType, dataBase64 } = req.body || {};
    if (!kind || !fileName || !contentType || !dataBase64) {
      return badRequest(res, "kind, fileName, contentType, dan dataBase64 wajib diisi");
    }

    const userRole = req.user?.role || "parent";
    const allowedByRole: Record<string, string[]> = {
      admin: ["logo", "favicon", "photo", "therapist-profile", "parent-profile", "child-profile"],
      therapist: ["therapist-profile", "child-profile"],
      parent: ["parent-profile", "child-profile"],
    };
    if (!allowedByRole[userRole]?.includes(kind)) {
      return badRequest(res, "Role akun ini tidak boleh mengunggah jenis file tersebut");
    }

    created(res, await storageService.uploadBrandingAsset({ kind, fileName, contentType, dataBase64 }));
  } catch (e) {
    return badRequest(res, e instanceof Error ? e.message : "Upload gagal");
  }
});

export default router;
