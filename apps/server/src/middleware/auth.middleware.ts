import type { Request, Response, NextFunction } from "express";
import { auth } from "../auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/index.js";
import { authSession, user as userTable } from "../db/schema.js";
import { DeviceAccessError, deviceAccessService } from "../services/device-access.service.js";
import { getRequestClientMeta } from "../utils/request-context.js";

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
            sessionId: authSession.id,
            sessionToken: authSession.token,
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
          session = { user: fallbackUser, session: { id: fallbackUser.sessionId, token: fallbackUser.sessionToken } } as any;
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

    const sessionRecord = (session as any).session || {};
    await deviceAccessService.assertSessionAllowed({
      userId: u.id,
      userRole: u.role || "parent",
      sessionId: sessionRecord.id,
      sessionToken: sessionRecord.token,
    }, getRequestClientMeta(req));

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
    if (error instanceof DeviceAccessError) {
      return res.status(error.status).json({ success: false, error: error.message, details: error.details });
    }
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
