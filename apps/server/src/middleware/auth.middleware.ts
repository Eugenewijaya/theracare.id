import type { Request, Response, NextFunction } from "express";
import { auth } from "../auth.js";
import { fromNodeHeaders } from "better-auth/node";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        role: string;
        status: string;
        phone?: string;
      };
    }
  }
}

/**
 * Middleware: require a valid Better Auth session
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session || !session.user) {
      return res.status(401).json({ error: "Unauthorized — silakan login terlebih dahulu" });
    }
    const u = session.user as any;
    if (u.status === "suspended" || u.status === "deleted" || u.banned) {
      return res.status(403).json({ error: "Akun Anda ditangguhkan" });
    }
    req.user = {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role || "parent",
      status: u.status || "active",
      phone: u.phone,
    };
    next();
  } catch {
    return res.status(401).json({ error: "Sesi tidak valid" });
  }
};

/**
 * Middleware: require specific role(s)
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Akses ditolak — role tidak sesuai" });
    }
    next();
  };
};
