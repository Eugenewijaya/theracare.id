import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { auditLogs, children, parents, reports, therapists, therapyPeriods, therapySessions, user as userTable } from "../db/schema.js";
import { periodDeletionRequestService } from "../services/period-deletion-request.service.js";
import { locationSignalService } from "../services/location-signal.service.js";
import { deviceAccessService } from "../services/device-access.service.js";
import { ok } from "../utils/response.js";

const router = Router();
const SENSITIVE_KEY_PATTERN = /(password|token|secret|credential|authorization|cookie|key)/i;

function getDeveloperToken() {
  return process.env.GOD_ADMIN_TOKEN || process.env.DEVELOPER_AUDIT_TOKEN || "";
}

function isTokenMatch(received: string, expected: string) {
  if (!received || !expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function requireDeveloperToken(req: any, res: any, next: any) {
  const expected = getDeveloperToken();
  if (!expected) {
    return res.status(503).json({
      success: false,
      error: "GOD_ADMIN_TOKEN belum dikonfigurasi di server.",
    });
  }

  const received = String(req.get("x-theracare-developer-token") || "").trim();
  if (!isTokenMatch(received, expected)) {
    return res.status(401).json({
      success: false,
      error: "Token developer tidak valid.",
    });
  }

  next();
}

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
    key,
    SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : redactSensitive(entry),
  ]));
}

async function countRows(table: any) {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(table);
  return Number(row?.count || 0);
}

async function countBy(column: any, table: any) {
  const rows = await db.select({ key: column, count: sql<number>`count(*)` }).from(table).groupBy(column);
  return Object.fromEntries(rows.map((row) => [String(row.key || "unknown"), Number(row.count || 0)]));
}

async function getActorUsers(actorUserIds: string[]) {
  if (actorUserIds.length === 0) return new Map();
  const rows = await db.select({
    id: userTable.id,
    name: userTable.name,
    email: userTable.email,
    role: userTable.role,
  }).from(userTable).where(inArray(userTable.id, actorUserIds));
  return new Map(rows.map((row) => [row.id, row]));
}

router.use(requireDeveloperToken);

router.get("/overview", async (_req, res, next) => {
  try {
    const [
      totalUsers,
      totalParents,
      totalTherapists,
      totalChildren,
      totalSessions,
      totalReports,
      usersByRole,
      sessionsByStatus,
      periodsByStatus,
      deletionRequests,
      deviceSessions,
      locationSignals,
      devicePolicies,
      recentLogs,
    ] = await Promise.all([
      countRows(userTable),
      countRows(parents),
      countRows(therapists),
      countRows(children),
      countRows(therapySessions),
      countRows(reports),
      countBy(userTable.role, userTable),
      countBy(therapySessions.status, therapySessions),
      countBy(therapyPeriods.status, therapyPeriods),
      periodDeletionRequestService.getDeveloperSnapshot(),
      deviceAccessService.listSessions({ limit: 20 }),
      locationSignalService.getAll(),
      deviceAccessService.getPolicies(),
      db.query.auditLogs.findMany({
        orderBy: (logs, { desc }) => [desc(logs.createdAt)],
        limit: 20,
      }),
    ]);

    ok(res, {
      generatedAt: new Date().toISOString(),
      totals: {
        users: totalUsers,
        parents: totalParents,
        therapists: totalTherapists,
        children: totalChildren,
        sessions: totalSessions,
        reports: totalReports,
      },
      usersByRole,
      sessionsByStatus,
      periodsByStatus,
      periodDeletionRequests: deletionRequests,
      deviceSummary: {
        latestSessions: deviceSessions,
        activeSessions: deviceSessions.filter((session) => session.active).length,
        uniqueIps: new Set(deviceSessions.map((session) => session.ipAddress).filter((ip) => ip && ip !== "unknown")).size,
        access: devicePolicies.summary,
      },
      locationSummary: locationSignals.summary,
      locationSignals: locationSignals.latest.slice(0, 20),
      recentAuditLogs: recentLogs.map((log) => ({ ...log, metadata: redactSensitive(log.metadata) })),
      securityBoundary: {
        passwordsVisible: false,
        locationTrackingVisible: false,
        note: "Password asli dan pelacakan lokasi tersembunyi tidak dicatat oleh sistem.",
      },
    });
  } catch (e) { next(e); }
});

router.get("/audit-logs", async (req, res, next) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 200)));
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType : "";
    const entityId = typeof req.query.entityId === "string" ? req.query.entityId : "";
    const action = typeof req.query.action === "string" ? req.query.action : "";

    const conditions = [];
    if (entityType) conditions.push(eq(auditLogs.entityType, entityType));
    if (entityId) conditions.push(eq(auditLogs.entityId, entityId));
    if (action) conditions.push(eq(auditLogs.action, action));

    const rows = await db.query.auditLogs.findMany({
      ...(conditions.length ? { where: and(...conditions) } : {}),
      orderBy: (logs, { desc }) => [desc(logs.createdAt)],
      limit,
    });
    const actorUserIds = Array.from(new Set(rows.map((log) => log.actorUserId).filter(Boolean) as string[]));
    const users = await getActorUsers(actorUserIds);
    ok(res, rows.map((log) => ({
      ...log,
      actor: log.actorUserId ? users.get(log.actorUserId) || null : null,
      metadata: redactSensitive(log.metadata),
    })));
  } catch (e) { next(e); }
});

router.get("/users", async (req, res, next) => {
  try {
    const role = typeof req.query.role === "string" ? req.query.role : "";
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 200)));
    const columns = {
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      phone: userTable.phone,
      role: userTable.role,
      status: userTable.status,
      banned: userTable.banned,
      createdAt: userTable.createdAt,
      updatedAt: userTable.updatedAt,
    };
    const rows = role
      ? await db.select(columns).from(userTable).where(eq(userTable.role, role)).orderBy(sql`${userTable.createdAt} desc`).limit(limit)
      : await db.select(columns).from(userTable).orderBy(sql`${userTable.createdAt} desc`).limit(limit);
    ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/device-sessions", async (req, res, next) => {
  try {
    const role = typeof req.query.role === "string" ? req.query.role : "";
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 200)));
    const activeOnly = String(req.query.activeOnly || "") === "true";
    ok(res, await deviceAccessService.listSessions({ role, limit, activeOnly }));
  } catch (e) { next(e); }
});

router.get("/location-signals", async (_req, res, next) => {
  try {
    ok(res, await locationSignalService.getAll());
  } catch (e) { next(e); }
});

router.get("/device-policies", async (_req, res, next) => {
  try {
    ok(res, await deviceAccessService.getPolicies());
  } catch (e) { next(e); }
});

router.patch("/device-access/:userId/policy", async (req, res, next) => {
  try {
    const policy = await deviceAccessService.setPolicy(req.params.userId as string, {
      mode: req.body?.mode,
      maxDevices: req.body?.maxDevices,
      note: req.body?.note,
      preferredDeviceId: req.body?.preferredDeviceId,
    }, { id: "developer", role: "developer" });
    ok(res, policy, "Policy perangkat diperbarui");
  } catch (e) { next(e); }
});

router.patch("/device-access/:userId/devices/:deviceId", async (req, res, next) => {
  try {
    const policy = await deviceAccessService.updateDevice(
      req.params.userId as string,
      decodeURIComponent(req.params.deviceId as string),
      {
        alias: req.body?.alias,
        trusted: typeof req.body?.trusted === "boolean" ? req.body.trusted : undefined,
        blocked: typeof req.body?.blocked === "boolean" ? req.body.blocked : undefined,
        reason: req.body?.reason,
      },
      { id: "developer", role: "developer" },
    );
    ok(res, policy, "Device diperbarui");
  } catch (e) { next(e); }
});

router.post("/device-access/:userId/devices/:deviceId/lock-only", async (req, res, next) => {
  try {
    const policy = await deviceAccessService.lockOnlyDevice(
      req.params.userId as string,
      decodeURIComponent(req.params.deviceId as string),
      { id: "developer", role: "developer" },
    );
    ok(res, policy, "User dikunci hanya untuk device ini");
  } catch (e) { next(e); }
});

router.delete("/device-sessions/:sessionId", async (req, res, next) => {
  try {
    const result = await deviceAccessService.revokeSession(
      req.params.sessionId as string,
      { id: "developer", role: "developer" },
      typeof req.query.reason === "string" ? req.query.reason : "",
    );
    ok(res, result, result.revoked ? "Session dimatikan" : "Session sudah tidak aktif");
  } catch (e) { next(e); }
});

export default router;
