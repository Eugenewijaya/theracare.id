import "dotenv/config";
import express from "express";
import cors, { type CorsOptions } from "cors";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { ensureProductionSchema } from "./db/production-schema.js";
import { errorHandler } from "./middleware/error.middleware.js";

// Routes
import parentRoutes from "./routes/parent.routes.js";
import childRoutes from "./routes/child.routes.js";
import therapistRoutes from "./routes/therapist.routes.js";
import sessionRoutes from "./routes/session.routes.js";
import reportRoutes from "./routes/report.routes.js";
import rescheduleRoutes from "./routes/reschedule.routes.js";
import therapyPeriodRoutes from "./routes/therapy-period.routes.js";
import leaveRequestRoutes from "./routes/leave-request.routes.js";
import meetingRoutes from "./routes/meeting.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import uploadRoutes from "./routes/upload.routes.js";

const app = express();
const PORT = process.env.PORT || 3000;
const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, "");
const configuredOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);
const configuredOriginSet = new Set(configuredOrigins);
const vercelOriginPattern = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;
const localhostOriginPattern = /^http:\/\/localhost:\d+$/i;

function isAllowedOrigin(origin: string) {
  return configuredOriginSet.has(origin)
    || vercelOriginPattern.test(origin)
    || localhostOriginPattern.test(origin);
}

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalized = normalizeOrigin(origin);
    if (isAllowedOrigin(normalized)) return callback(null, true);
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
};

await ensureProductionSchema();

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

// ── Middleware ──────────────────────────────────────────
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Railway's Node adapter can fail before Better Auth parses JSON bodies.
// Keep explicit JSON routes for credential auth endpoints that the portals use.
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
    const response = await auth.api.changePassword({
      body: req.body,
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    });
    await sendAuthResponse(res, response);
  } catch (e) {
    next(e);
  }
});

// Better Auth handler MUST be before express.json() for its own body parsing
app.all("/api/auth/*", toNodeHandler(auth));

app.use(express.json({ limit: "10mb" }));

// ── Health Check ───────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "TheraCare API",
  });
});

// ── API Routes ─────────────────────────────────────────
app.use("/api/parents", parentRoutes);
app.use("/api/children", childRoutes);
app.use("/api/therapists", therapistRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/reschedule", rescheduleRoutes);
app.use("/api/therapy-periods", therapyPeriodRoutes);
app.use("/api/leave-requests", leaveRequestRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/uploads", uploadRoutes);

// ── Error Handler ──────────────────────────────────────
app.use(errorHandler);

// ── Start Server ───────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏥 TheraCare API Server`);
  console.log(`   ├─ Local:  http://localhost:${PORT}`);
  console.log(`   ├─ Health: http://localhost:${PORT}/api/health`);
  console.log(`   └─ Auth:   http://localhost:${PORT}/api/auth\n`);
});
