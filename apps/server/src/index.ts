import "dotenv/config";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { errorHandler } from "./middleware/error.middleware.js";

// Routes
import parentRoutes from "./routes/parent.routes.js";
import childRoutes from "./routes/child.routes.js";
import therapistRoutes from "./routes/therapist.routes.js";
import sessionRoutes from "./routes/session.routes.js";
import reportRoutes from "./routes/report.routes.js";
import rescheduleRoutes from "./routes/reschedule.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import adminRoutes from "./routes/admin.routes.js";

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || "http://localhost:5173")
      .split(",")
      .map((s) => s.trim()),
    credentials: true,
  })
);

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
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);

// ── Error Handler ──────────────────────────────────────
app.use(errorHandler);

// ── Start Server ───────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏥 TheraCare API Server`);
  console.log(`   ├─ Local:  http://localhost:${PORT}`);
  console.log(`   ├─ Health: http://localhost:${PORT}/api/health`);
  console.log(`   └─ Auth:   http://localhost:${PORT}/api/auth\n`);
});
