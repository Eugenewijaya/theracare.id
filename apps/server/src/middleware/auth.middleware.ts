import type { Request, Response, NextFunction } from "express";
import { auth } from "../auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/index.js";
import { authSession, user as userTable } from "../db/schema.js";

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

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user) {
      const token = req.get("x-theracare-session-token")?.trim();
      if (token) {
        const [fallbackUser] = await db
          .select({
            id: userTable.id,
            name: userTable.name,
            email: userTable.email,
            role: userTable.role,
            status: userTable.status,
            phone: userTable.phone,
            banned: userTable.banned,
          })
          .from(authSession)
          .innerJoin(userTable, eq(authSession.userId, userTable.id))
          .where(and(eq(authSession.token, token), gt(authSession.expiresAt, new Date())))
          .limit(1);

        if (fallbackUser) {
          session = { user: fallbackUser } as any;
        }
      }
    }

    if (!session?.user) {
      return res.status(401).json({ success: false, error: "Unauthorized - silakan login terlebih dahulu" });
    }

    const u = session.user as any;
    if (u.status === "suspended" || u.status === "deleted" || u.banned) {
      return res.status(403).json({ success: false, error: "Akun Anda ditangguhkan" });
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
  } catch (error) {
    console.error("[auth] session validation failed", error);
    return res.status(401).json({ success: false, error: "Sesi tidak valid" });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "Akses ditolak - role tidak sesuai" });
    }
    next();
  };
};
