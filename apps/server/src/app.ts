import "dotenv/config";
import express from "express";
import cors, { type CorsOptions } from "cors";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { and, eq, gt } from "drizzle-orm";
import { auth } from "./auth.js";
import { ensureProductionSchema } from "./db/production-schema.js";
import { db } from "./db/index.js";
import { authSession, user as userTable } from "./db/schema.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { setCredentialPassword, verifyCredentialPassword } from "./services/auth-password.service.js";
import { auditLogService } from "./services/audit-log.service.js";
import { notificationService } from "./services/notification.service.js";
import { syncService } from "./services/sync.service.js";
import { pool } from "./db/index.js";
import { getDatabaseEnvKey, hasDatabaseUrl } from "./config/database.js";
import { getConfiguredOrigins, isAllowedOrigin, normalizeOrigin } from "./config/origins.js";

import parentRoutes from "./routes/parent.routes.js";
import childRoutes from "./routes/child.routes.js";
import therapistRoutes from "./routes/therapist.routes.js";
import sessionRoutes from "./routes/session.routes.js";
import reportRoutes from "./routes/report.routes.js";
import rescheduleRoutes from "./routes/reschedule.routes.js";
import therapyPeriodRoutes from "./routes/therapy-period.routes.js";
import leaveRequestRoutes from "./routes/leave-request.routes.js";
import substituteRequestRoutes from "./routes/substitute-request.routes.js";
import meetingRoutes from "./routes/meeting.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import auditLogRoutes from "./routes/audit-log.routes.js";
import developerRoutes from "./routes/developer.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import syncRoutes from "./routes/sync.routes.js";

const app = express();
const configuredOrigins = getConfiguredOrigins();
const configuredOriginSet = new Set(configuredOrigins.map(normalizeOrigin));
let schemaReadyPromise: Promise<void> | null = null;

export async function ensureAppReady() {
  if (!hasDatabaseUrl()) return;
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureProductionSchema().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  await schemaReadyPromise;
}

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalized = normalizeOrigin(origin);
    if (configuredOriginSet.has(normalized) || isAllowedOrigin(normalized, configuredOrigins)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
};

function ensureReadyMiddleware(_req: express.Request, _res: express.Response, next: express.NextFunction) {
  ensureAppReady().then(() => next(), next);
}

function shouldTrackMutation(req: express.Request) {
  if (!["POST", "PATCH", "DELETE"].includes(req.method)) return false;
  const path = req.path || req.originalUrl || "";
  if (!path.startsWith("/api/")) return false;
  if (path.startsWith("/api/sync")) return false;
  if (path.startsWith("/api/health")) return false;
  if (path.startsWith("/api/auth/sign-in") || path.startsWith("/api/auth/sign-out") || path.startsWith("/api/auth/get-session")) {
    return false;
  }
  if (path === "/api/notifications/read-all" || /^\/api\/notifications\/[^/]+\/read$/.test(path)) {
    return false;
  }
  return true;
}

function trackMutationRevision(req: express.Request, res: express.Response, next: express.NextFunction) {
  const shouldTrack = shouldTrackMutation(req);
  if (shouldTrack) {
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        void syncService.bump(`${req.method} ${req.path}`).catch((error) => {
          console.error("[sync] failed to bump system revision", error);
        });
      }
    });
  }
  next();
}

async function sendAuthResponse(res: express.Response, response: Response) {
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") res.setHeader(key, value);
  });

  const setCookies = (response.headers as any).getSetCookie?.() || [];
  if (setCookies.length > 0) {
    res.setHeader("set-cookie", setCookies);
  } else {
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) res.setHeader("set-cookie", setCookie);
  }

  const body = Buffer.from(await response.arrayBuffer());
  res.status(response.status).send(body);
}

async function getSessionWithTokenFallback(req: express.Request) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (session?.user) return session;

  const token = req.get("x-theracare-session-token")?.trim();
  if (!token) return null;

  const [fallbackUser] = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
      status: userTable.status,
      phone: userTable.phone,
      banned: userTable.banned,
      image: userTable.image,
      emailVerified: userTable.emailVerified,
      createdAt: userTable.createdAt,
      updatedAt: userTable.updatedAt,
    })
    .from(authSession)
    .innerJoin(userTable, eq(authSession.userId, userTable.id))
    .where(and(eq(authSession.token, token), gt(authSession.expiresAt, new Date())))
    .limit(1);

  return fallbackUser ? { user: fallbackUser, session: { token } } : null;
}

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "TheraCare API",
    database: hasDatabaseUrl() ? "configured" : "unconfigured",
  });
});

app.get("/api/health/db", async (_req, res) => {
  if (!hasDatabaseUrl()) {
    return res.status(503).json({
      status: "error",
      database: "unconfigured",
      message: "Database environment variable is not configured",
    });
  }

  try {
    await ensureAppReady();
    await pool.query("select 1");
    res.json({
      status: "ok",
      database: "ok",
      envKey: getDatabaseEnvKey(),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: "error",
      database: "unavailable",
      code: error?.code || error?.name || "DB_ERROR",
      message: process.env.NODE_ENV === "development" ? error?.message : undefined,
    });
  }
});

app.use(ensureReadyMiddleware);

app.post("/api/auth/sign-in/email", express.json({ limit: "1mb" }), async (req, res, next) => {
  try {
    const response = await auth.api.signInEmail({
      body: req.body,
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    });
    await sendAuthResponse(res, response);
  } catch (e) {
    next(e);
  }
});

app.post("/api/auth/change-password", express.json({ limit: "1mb" }), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "Password lama dan password baru wajib diisi" });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, error: "Password baru minimal 8 karakter" });
    }

    const session = await getSessionWithTokenFallback(req);
    if (!session?.user) {
      return res.status(401).json({ success: false, error: "Unauthorized - silakan login terlebih dahulu" });
    }

    if (!(await verifyCredentialPassword(session.user.id, currentPassword))) {
      return res.status(400).json({ success: false, error: "Password lama tidak valid" });
    }

    await setCredentialPassword(session.user.id, newPassword);
    const role = String(session.user.role || "all");
    const targetRole = ["admin", "parent", "therapist", "all"].includes(role) ? role : "all";
    await auditLogService.create({
      actor: { id: session.user.id, role: targetRole },
      action: "auth.password.change",
      entityType: "user",
      entityId: session.user.id,
      summary: `Password akun ${role} diperbarui oleh pemilik akun`,
      metadata: { selfService: true, revokeOtherSessions: Boolean(req.body?.revokeOtherSessions) },
    });
    await notificationService.create({
      type: "account_security",
      icon: "key",
      title: "Password akun diperbarui",
      message: "Password akun Anda berhasil diperbarui. Jika bukan Anda yang melakukan perubahan ini, segera hubungi admin.",
      targetRole,
      targetUserId: session.user.id,
      relatedId: session.user.id,
    });
    void syncService.bump("POST /api/auth/change-password").catch((error) => {
      console.error("[sync] failed to bump system revision", error);
    });
    res.json({ success: true, message: "Password berhasil diubah. Silakan login kembali." });
  } catch (e) {
    next(e);
  }
});

app.get("/api/auth/get-session", async (req, res, next) => {
  try {
    const session = await getSessionWithTokenFallback(req);
    if (!session?.user) return res.status(401).json({ error: "Unauthorized - silakan login terlebih dahulu" });
    res.json(session);
  } catch (e) {
    next(e);
  }
});

app.all("/api/auth/*", toNodeHandler(auth));

app.use(express.json({ limit: "10mb" }));
app.use(trackMutationRevision);

app.use("/api/sync", syncRoutes);
app.use("/api/parents", parentRoutes);
app.use("/api/children", childRoutes);
app.use("/api/therapists", therapistRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/reschedule", rescheduleRoutes);
app.use("/api/therapy-periods", therapyPeriodRoutes);
app.use("/api/leave-requests", leaveRequestRoutes);
app.use("/api/substitute-requests", substituteRequestRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/developer", developerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/uploads", uploadRoutes);

app.use(errorHandler);

export default app;
