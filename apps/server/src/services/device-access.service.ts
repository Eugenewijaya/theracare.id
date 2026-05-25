import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { authSession, clinicSettings, user as userTable } from "../db/schema.js";
import { auditLogService } from "./audit-log.service.js";
import { parseUserAgent } from "../utils/request-context.js";

const DEVICE_ACCESS_KEY = "deviceAccessPolicies";
const DEVICE_SESSION_META_KEY = "deviceSessionMetadata";
const MAX_SESSION_METADATA = 1200;
const DEFAULT_MAX_DEVICES = 3;

type Actor = {
  id?: string;
  role?: string;
};

type DeviceClientMeta = {
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  deviceLabel?: string;
  deviceScreen?: string;
  deviceTimezone?: string;
};

type DevicePolicyMode = "open" | "max_devices" | "locked_devices";

type UserDevicePolicy = {
  mode: DevicePolicyMode;
  maxDevices: number;
  trustedDeviceIds: string[];
  blockedDeviceIds: string[];
  blockedSessionIds: string[];
  aliases: Record<string, string>;
  note?: string;
  updatedAt?: string;
  updatedBy?: string;
};

type DeviceAccessState = {
  users: Record<string, UserDevicePolicy>;
};

type SessionDeviceMeta = {
  sessionId: string;
  userId: string;
  deviceId: string;
  deviceLabel?: string;
  deviceScreen?: string;
  deviceTimezone?: string;
  ipAddress?: string;
  userAgent?: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

type SessionDeviceState = {
  sessions: Record<string, SessionDeviceMeta>;
};

export class DeviceAccessError extends Error {
  status = 403;
  code: string;
  details?: Record<string, unknown>;

  constructor(message: string, code = "DEVICE_ACCESS_DENIED", details: Record<string, unknown> = {}) {
    super(message);
    this.name = "DeviceAccessError";
    this.code = code;
    this.details = { code, ...details };
  }
}

function safeJson<T>(value: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(value || "") || fallback;
  } catch {
    return fallback;
  }
}

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.query.clinicSettings.findFirst({ where: eq(clinicSettings.key, key) });
  return safeJson(row?.value, fallback);
}

async function writeSetting(key: string, value: unknown) {
  await db.insert(clinicSettings)
    .values({ key, value: JSON.stringify(value), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: clinicSettings.key,
      set: { value: JSON.stringify(value), updatedAt: new Date() },
    });
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function cleanText(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeMode(value: unknown): DevicePolicyMode {
  const mode = String(value || "").toLowerCase();
  if (mode === "max_devices" || mode === "locked_devices") return mode;
  return "open";
}

function normalizeMaxDevices(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_DEVICES;
  return Math.min(10, Math.max(1, Math.trunc(parsed)));
}

function defaultPolicy(): UserDevicePolicy {
  return {
    mode: "open",
    maxDevices: DEFAULT_MAX_DEVICES,
    trustedDeviceIds: [],
    blockedDeviceIds: [],
    blockedSessionIds: [],
    aliases: {},
  };
}

function normalizePolicy(input?: Partial<UserDevicePolicy> | null): UserDevicePolicy {
  return {
    ...defaultPolicy(),
    ...(input || {}),
    mode: normalizeMode(input?.mode),
    maxDevices: normalizeMaxDevices(input?.maxDevices),
    trustedDeviceIds: uniq(Array.isArray(input?.trustedDeviceIds) ? input!.trustedDeviceIds : []),
    blockedDeviceIds: uniq(Array.isArray(input?.blockedDeviceIds) ? input!.blockedDeviceIds : []),
    blockedSessionIds: uniq(Array.isArray(input?.blockedSessionIds) ? input!.blockedSessionIds : []),
    aliases: input?.aliases && typeof input.aliases === "object" ? input.aliases : {},
  };
}

async function readAccessState(): Promise<DeviceAccessState> {
  const state = await readSetting<DeviceAccessState>(DEVICE_ACCESS_KEY, { users: {} });
  return {
    users: Object.fromEntries(Object.entries(state.users || {}).map(([userId, policy]) => [userId, normalizePolicy(policy)])),
  };
}

async function writeAccessState(state: DeviceAccessState) {
  await writeSetting(DEVICE_ACCESS_KEY, state);
}

async function readSessionMetaState(): Promise<SessionDeviceState> {
  const state = await readSetting<SessionDeviceState>(DEVICE_SESSION_META_KEY, { sessions: {} });
  return {
    sessions: state.sessions && typeof state.sessions === "object" ? state.sessions : {},
  };
}

async function writeSessionMetaState(state: SessionDeviceState) {
  const entries = Object.values(state.sessions || {})
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
    .slice(0, MAX_SESSION_METADATA);
  await writeSetting(DEVICE_SESSION_META_KEY, { sessions: Object.fromEntries(entries.map((entry) => [entry.sessionId, entry])) });
}

function getPolicy(state: DeviceAccessState, userId: string) {
  return normalizePolicy(state.users[userId]);
}

function resolveDeviceId(meta: DeviceClientMeta = {}, sessionId?: string) {
  const explicit = cleanText(meta.deviceId, 160);
  if (explicit) return explicit;
  return sessionId ? `legacy:${sessionId}` : "unknown";
}

function displayDeviceLabel(policy: UserDevicePolicy, deviceId: string, sessionMeta: SessionDeviceMeta | undefined, userAgent = "") {
  const parsed = parseUserAgent(userAgent);
  return policy.aliases[deviceId]
    || sessionMeta?.deviceLabel
    || parsed.deviceName
    || parsed.deviceModel
    || parsed.deviceType
    || "Perangkat tidak dikenal";
}

async function getSessionIdsForDevice(userId: string, deviceId: string) {
  const metaState = await readSessionMetaState();
  const rows = await db.select({ id: authSession.id }).from(authSession).where(eq(authSession.userId, userId));
  return rows
    .filter((row) => {
      const meta = metaState.sessions[row.id];
      const rowDeviceId = meta?.deviceId || `legacy:${row.id}`;
      return rowDeviceId === deviceId;
    })
    .map((row) => row.id);
}

async function deleteSessions(sessionIds: string[]) {
  const ids = uniq(sessionIds);
  if (ids.length === 0) return 0;
  await db.delete(authSession).where(inArray(authSession.id, ids));
  return ids.length;
}

async function getActiveDeviceIdsForUser(userId: string) {
  const metaState = await readSessionMetaState();
  const rows = await db.select({ id: authSession.id }).from(authSession)
    .where(and(eq(authSession.userId, userId), gt(authSession.expiresAt, new Date())));
  return uniq(rows.map((row) => metaState.sessions[row.id]?.deviceId || `legacy:${row.id}`));
}

async function trimActiveDevices(userId: string, maxDevices: number, preferredDeviceId = "") {
  const metaState = await readSessionMetaState();
  const rows = await db.select({ id: authSession.id, createdAt: authSession.createdAt }).from(authSession)
    .where(and(eq(authSession.userId, userId), gt(authSession.expiresAt, new Date())))
    .orderBy(sql`${authSession.createdAt} desc`);
  const keepDevices = new Set<string>();
  if (preferredDeviceId) keepDevices.add(preferredDeviceId);

  const revokeSessionIds: string[] = [];
  for (const row of rows) {
    const deviceId = metaState.sessions[row.id]?.deviceId || `legacy:${row.id}`;
    if (keepDevices.has(deviceId)) continue;
    if (keepDevices.size < maxDevices) {
      keepDevices.add(deviceId);
      continue;
    }
    revokeSessionIds.push(row.id);
  }

  return deleteSessions(revokeSessionIds);
}

async function audit(actor: Actor | undefined, action: string, entityId: string, summary: string, metadata: Record<string, unknown> = {}) {
  await auditLogService.create({
    actor: actor || { id: "developer", role: "developer" },
    action,
    entityType: "device_access",
    entityId,
    summary,
    metadata,
  }).catch((error) => {
    console.error("[device-access] failed to write audit log", error);
  });
}

export const deviceAccessService = {
  async recordSessionDevice(sessionId: string | undefined, userId: string, meta: DeviceClientMeta = {}) {
    if (!sessionId || !userId) return null;
    const state = await readSessionMetaState();
    const now = new Date().toISOString();
    const previous = state.sessions[sessionId];
    const next: SessionDeviceMeta = {
      sessionId,
      userId,
      deviceId: resolveDeviceId(meta, sessionId),
      deviceLabel: cleanText(meta.deviceLabel),
      deviceScreen: cleanText(meta.deviceScreen, 80),
      deviceTimezone: cleanText(meta.deviceTimezone, 120),
      ipAddress: cleanText(meta.ipAddress, 80),
      userAgent: cleanText(meta.userAgent, 500),
      firstSeenAt: previous?.firstSeenAt || now,
      lastSeenAt: now,
    };
    state.sessions[sessionId] = next;
    await writeSessionMetaState(state);
    return next;
  },

  async assertSessionAllowed(input: {
    userId: string;
    userRole?: string;
    sessionId?: string;
    sessionToken?: string;
  }, meta: DeviceClientMeta = {}) {
    if (!input.userId) return;
    const sessionMeta = await this.recordSessionDevice(input.sessionId, input.userId, meta);
    const deviceId = sessionMeta?.deviceId || resolveDeviceId(meta, input.sessionId);
    const accessState = await readAccessState();
    const policy = getPolicy(accessState, input.userId);
    const blockedByDevice = policy.blockedDeviceIds.includes(deviceId);
    const blockedBySession = Boolean(input.sessionId && policy.blockedSessionIds.includes(input.sessionId));

    if (blockedByDevice || blockedBySession) {
      await deleteSessions(input.sessionId ? [input.sessionId] : []);
      throw new DeviceAccessError(
        "Perangkat ini diblokir oleh developer. Silakan gunakan perangkat yang diizinkan atau hubungi admin.",
        "DEVICE_BLOCKED",
        { userId: input.userId, deviceId, mode: policy.mode },
      );
    }

    if (policy.mode === "locked_devices" && !policy.trustedDeviceIds.includes(deviceId)) {
      await deleteSessions(input.sessionId ? [input.sessionId] : []);
      throw new DeviceAccessError(
        "Akun ini dikunci hanya untuk perangkat tertentu.",
        "DEVICE_NOT_TRUSTED",
        { userId: input.userId, deviceId, mode: policy.mode },
      );
    }

    if (policy.mode === "max_devices") {
      const activeDeviceIds = uniq([...(await getActiveDeviceIdsForUser(input.userId)), deviceId]);
      if (!activeDeviceIds.includes(deviceId) || activeDeviceIds.length > policy.maxDevices) {
        await deleteSessions(input.sessionId ? [input.sessionId] : []);
        throw new DeviceAccessError(
          `Akun ini dibatasi maksimal ${policy.maxDevices} perangkat aktif.`,
          "DEVICE_LIMIT_EXCEEDED",
          { userId: input.userId, deviceId, activeDevices: activeDeviceIds.length, maxDevices: policy.maxDevices },
        );
      }
    }
  },

  async listSessions(filters: { role?: string; limit?: number; activeOnly?: boolean } = {}) {
    const limit = Math.min(500, Math.max(1, Number(filters.limit || 100)));
    const conditions = [];
    if (filters.role) conditions.push(eq(userTable.role, filters.role));
    if (filters.activeOnly) conditions.push(gt(authSession.expiresAt, new Date()));

    const columns = {
      id: authSession.id,
      userId: authSession.userId,
      userName: userTable.name,
      userEmail: userTable.email,
      userRole: userTable.role,
      userStatus: userTable.status,
      ipAddress: authSession.ipAddress,
      userAgent: authSession.userAgent,
      createdAt: authSession.createdAt,
      updatedAt: authSession.updatedAt,
      expiresAt: authSession.expiresAt,
    };
    const baseQuery = db.select(columns)
      .from(authSession)
      .innerJoin(userTable, eq(authSession.userId, userTable.id));
    const rows = conditions.length
      ? await baseQuery.where(and(...conditions)).orderBy(sql`${authSession.createdAt} desc`).limit(limit)
      : await baseQuery.orderBy(sql`${authSession.createdAt} desc`).limit(limit);

    const [accessState, metaState] = await Promise.all([readAccessState(), readSessionMetaState()]);
    return rows.map((row) => {
      const expiresAt = row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt);
      const active = !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date();
      const sessionMeta = metaState.sessions[row.id];
      const deviceId = sessionMeta?.deviceId || `legacy:${row.id}`;
      const policy = getPolicy(accessState, row.userId);
      const parsed = parseUserAgent(row.userAgent || sessionMeta?.userAgent || "");
      const trusted = policy.trustedDeviceIds.includes(deviceId);
      const blocked = policy.blockedDeviceIds.includes(deviceId) || policy.blockedSessionIds.includes(row.id);
      const policyLocked = policy.mode === "locked_devices" && !trusted;
      return {
        ...row,
        ...parsed,
        active,
        ipAddress: row.ipAddress || sessionMeta?.ipAddress || "unknown",
        userAgent: row.userAgent || sessionMeta?.userAgent || "",
        deviceId,
        deviceLabel: displayDeviceLabel(policy, deviceId, sessionMeta, row.userAgent || sessionMeta?.userAgent || ""),
        deviceScreen: sessionMeta?.deviceScreen || "",
        deviceTimezone: sessionMeta?.deviceTimezone || "",
        trusted,
        blocked,
        accessPolicyMode: policy.mode,
        accessMaxDevices: policy.maxDevices,
        accessStatus: blocked ? "blocked" : policyLocked ? "not_trusted" : active ? "active" : "expired",
      };
    });
  },

  async getPolicies() {
    const state = await readAccessState();
    const policies = Object.entries(state.users).map(([userId, policy]) => ({ userId, ...policy }));
    return {
      users: state.users,
      policies,
      summary: {
        usersWithPolicy: policies.length,
        lockedUsers: policies.filter((policy) => policy.mode === "locked_devices").length,
        limitedUsers: policies.filter((policy) => policy.mode === "max_devices").length,
        blockedDevices: policies.reduce((sum, policy) => sum + policy.blockedDeviceIds.length, 0),
        trustedDevices: policies.reduce((sum, policy) => sum + policy.trustedDeviceIds.length, 0),
      },
    };
  },

  async setPolicy(userId: string, updates: Partial<UserDevicePolicy> & { preferredDeviceId?: string }, actor?: Actor) {
    const state = await readAccessState();
    const current = getPolicy(state, userId);
    const next = normalizePolicy({
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: actor?.id || "developer",
    });
    state.users[userId] = next;
    await writeAccessState(state);
    const revokedSessions = next.mode === "max_devices"
      ? await trimActiveDevices(userId, next.maxDevices, cleanText(updates.preferredDeviceId, 160))
      : 0;
    await audit(actor, "device.policy.update", userId, `Policy device user ${userId} diperbarui`, {
      mode: next.mode,
      maxDevices: next.maxDevices,
      trustedDevices: next.trustedDeviceIds.length,
      blockedDevices: next.blockedDeviceIds.length,
      revokedSessions,
    });
    return next;
  },

  async updateDevice(userId: string, deviceId: string, updates: {
    alias?: string;
    trusted?: boolean;
    blocked?: boolean;
    reason?: string;
  }, actor?: Actor) {
    const state = await readAccessState();
    const current = getPolicy(state, userId);
    const aliases = { ...current.aliases };
    const cleanAlias = cleanText(updates.alias);
    if (updates.alias !== undefined) {
      if (cleanAlias) aliases[deviceId] = cleanAlias;
      else delete aliases[deviceId];
    }
    const trustedDeviceIds = updates.trusted === undefined
      ? current.trustedDeviceIds
      : updates.trusted
        ? uniq([...current.trustedDeviceIds, deviceId])
        : current.trustedDeviceIds.filter((id) => id !== deviceId);
    const blockedDeviceIds = updates.blocked === undefined
      ? current.blockedDeviceIds
      : updates.blocked
        ? uniq([...current.blockedDeviceIds, deviceId])
        : current.blockedDeviceIds.filter((id) => id !== deviceId);
    const next = normalizePolicy({
      ...current,
      aliases,
      trustedDeviceIds,
      blockedDeviceIds,
      updatedAt: new Date().toISOString(),
      updatedBy: actor?.id || "developer",
      note: cleanText(updates.reason, 240) || current.note,
    });
    state.users[userId] = next;
    await writeAccessState(state);

    let revokedSessions = 0;
    if (updates.blocked) {
      revokedSessions = await deleteSessions(await getSessionIdsForDevice(userId, deviceId));
    }

    await audit(actor, "device.access.update", userId, `Akses device user ${userId} diperbarui`, {
      deviceId,
      alias: aliases[deviceId] || null,
      trusted: next.trustedDeviceIds.includes(deviceId),
      blocked: next.blockedDeviceIds.includes(deviceId),
      revokedSessions,
      reason: cleanText(updates.reason, 240),
    });
    return next;
  },

  async lockOnlyDevice(userId: string, deviceId: string, actor?: Actor) {
    const state = await readAccessState();
    const current = getPolicy(state, userId);
    const next = normalizePolicy({
      ...current,
      mode: "locked_devices",
      trustedDeviceIds: [deviceId],
      blockedDeviceIds: current.blockedDeviceIds.filter((id) => id !== deviceId),
      updatedAt: new Date().toISOString(),
      updatedBy: actor?.id || "developer",
    });
    state.users[userId] = next;
    await writeAccessState(state);
    const sessions = await db.select({ id: authSession.id }).from(authSession).where(eq(authSession.userId, userId));
    const metaState = await readSessionMetaState();
    const revokeIds = sessions
      .filter((session) => (metaState.sessions[session.id]?.deviceId || `legacy:${session.id}`) !== deviceId)
      .map((session) => session.id);
    const revokedSessions = await deleteSessions(revokeIds);
    await audit(actor, "device.policy.lock_only", userId, `User ${userId} dikunci hanya untuk device tertentu`, {
      deviceId,
      revokedSessions,
    });
    return next;
  },

  async revokeSession(sessionId: string, actor?: Actor, reason = "") {
    const [row] = await db.select({ id: authSession.id, userId: authSession.userId }).from(authSession).where(eq(authSession.id, sessionId)).limit(1);
    if (!row) return { revoked: false };
    await deleteSessions([sessionId]);
    await audit(actor, "device.session.revoke", row.userId, `Session ${sessionId} dimatikan paksa oleh developer`, {
      sessionId,
      reason: cleanText(reason, 240),
    });
    return { revoked: true, userId: row.userId, sessionId };
  },

  async revokeSessionsByRole(role = "all", actor?: Actor, reason = "") {
    const normalizedRole = cleanText(role, 40).toLowerCase();
    const targetRole = ["admin", "therapist", "parent"].includes(normalizedRole) ? normalizedRole : "all";
    const columns = {
      id: authSession.id,
      userId: authSession.userId,
      userRole: userTable.role,
    };
    const baseQuery = db.select(columns)
      .from(authSession)
      .innerJoin(userTable, eq(authSession.userId, userTable.id));
    const rows = targetRole === "all"
      ? await baseQuery
      : await baseQuery.where(eq(userTable.role, targetRole));
    const revokedSessions = await deleteSessions(rows.map((row) => row.id));
    const affectedUsers = new Set(rows.map((row) => row.userId)).size;

    await audit(
      actor,
      "device.sessions.revoke_bulk",
      targetRole,
      targetRole === "all"
        ? "Semua session user dimatikan paksa oleh developer"
        : `Semua session role ${targetRole} dimatikan paksa oleh developer`,
      {
        role: targetRole,
        revokedSessions,
        affectedUsers,
        reason: cleanText(reason, 240),
      },
    );

    return {
      role: targetRole,
      revokedSessions,
      affectedUsers,
    };
  },
};
