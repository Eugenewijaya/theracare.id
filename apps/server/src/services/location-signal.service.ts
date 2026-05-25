import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicSettings } from "../db/schema.js";
import { generateId } from "../utils/id-generators.js";
import { parseUserAgent } from "../utils/request-context.js";
import { auditLogService } from "./audit-log.service.js";

const LOCATION_SIGNALS_KEY = "locationSignals";
const MAX_LOCATION_HISTORY = 500;

type Actor = {
  id?: string;
  role?: string;
  name?: string;
  email?: string;
};

type ClientMeta = {
  ipAddress?: string;
  userAgent?: string;
};

type LocationInput = {
  permissionStatus?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  source?: string;
  reason?: string;
};

type LocationSignal = {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  role: string;
  permissionStatus: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  source: string;
  reason?: string;
  ipAddress: string;
  userAgent: string;
  browser: string;
  os: string;
  deviceType: string;
  createdAt: string;
  updatedAt: string;
};

type LocationState = {
  latest: Record<string, LocationSignal>;
  history: LocationSignal[];
};

function parseState(value?: string | null): LocationState {
  try {
    const parsed = JSON.parse(value || "{}");
    return {
      latest: parsed?.latest && typeof parsed.latest === "object" ? parsed.latest : {},
      history: Array.isArray(parsed?.history) ? parsed.history : [],
    };
  } catch {
    return { latest: {}, history: [] };
  }
}

async function readState() {
  const row = await db.query.clinicSettings.findFirst({
    where: eq(clinicSettings.key, LOCATION_SIGNALS_KEY),
  });
  return parseState(row?.value);
}

async function writeState(state: LocationState) {
  const value = JSON.stringify({
    latest: state.latest,
    history: state.history.slice(0, MAX_LOCATION_HISTORY),
  });
  await db.insert(clinicSettings)
    .values({ key: LOCATION_SIGNALS_KEY, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: clinicSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

function toFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizePermissionStatus(value: unknown) {
  const status = String(value || "").toLowerCase();
  if (["granted", "denied", "prompt", "unavailable", "unsupported", "error"].includes(status)) return status;
  return "prompt";
}

function buildSignal(actor: Actor, input: LocationInput, clientMeta: ClientMeta, previous?: LocationSignal): LocationSignal {
  const now = new Date().toISOString();
  const userAgent = clientMeta.userAgent || previous?.userAgent || "";
  const device = parseUserAgent(userAgent);
  const latitude = toFiniteNumber(input.latitude);
  const longitude = toFiniteNumber(input.longitude);
  const accuracy = toFiniteNumber(input.accuracy);
  const altitude = input.altitude === null ? null : toFiniteNumber(input.altitude);
  const heading = input.heading === null ? null : toFiniteNumber(input.heading);
  const speed = input.speed === null ? null : toFiniteNumber(input.speed);

  return {
    id: generateId("LOC"),
    userId: actor.id || "unknown",
    userName: actor.name || previous?.userName || "",
    userEmail: actor.email || previous?.userEmail || "",
    role: actor.role || previous?.role || "unknown",
    permissionStatus: normalizePermissionStatus(input.permissionStatus),
    ...(latitude !== undefined ? { latitude } : previous?.latitude !== undefined ? { latitude: previous.latitude } : {}),
    ...(longitude !== undefined ? { longitude } : previous?.longitude !== undefined ? { longitude: previous.longitude } : {}),
    ...(accuracy !== undefined ? { accuracy } : previous?.accuracy !== undefined ? { accuracy: previous.accuracy } : {}),
    ...(altitude !== undefined ? { altitude } : previous?.altitude !== undefined ? { altitude: previous.altitude } : {}),
    ...(heading !== undefined ? { heading } : previous?.heading !== undefined ? { heading: previous.heading } : {}),
    ...(speed !== undefined ? { speed } : previous?.speed !== undefined ? { speed: previous.speed } : {}),
    source: input.source || "web",
    reason: input.reason || "",
    ipAddress: clientMeta.ipAddress || previous?.ipAddress || "unknown",
    userAgent,
    browser: device.browser,
    os: device.os,
    deviceType: device.deviceType,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };
}

export const locationSignalService = {
  async record(actor: Actor, input: LocationInput, clientMeta: ClientMeta = {}) {
    if (!actor?.id) throw new Error("User tidak valid untuk menyimpan lokasi.");
    const state = await readState();
    const previous = state.latest[actor.id];
    const signal = buildSignal(actor, input, clientMeta, previous);
    state.latest[actor.id] = signal;
    state.history = [signal, ...state.history.filter((entry) => entry.id !== signal.id)].slice(0, MAX_LOCATION_HISTORY);
    await writeState(state);

    if (!previous || previous.permissionStatus !== signal.permissionStatus) {
      await auditLogService.create({
        actor,
        action: "location.permission.update",
        entityType: "location_signal",
        entityId: actor.id,
        summary: `Permission lokasi ${actor.role || "user"} berubah menjadi ${signal.permissionStatus}`,
        metadata: {
          permissionStatus: signal.permissionStatus,
          source: signal.source,
          hasCoordinates: Number.isFinite(signal.latitude) && Number.isFinite(signal.longitude),
          ipAddress: signal.ipAddress,
          deviceType: signal.deviceType,
          browser: signal.browser,
          os: signal.os,
        },
      });
    }

    return signal;
  },

  async getForUser(userId: string) {
    const state = await readState();
    return state.latest[userId] || null;
  },

  async getAll() {
    const state = await readState();
    const latest = Object.values(state.latest).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return {
      latest,
      history: state.history,
      summary: {
        users: latest.length,
        granted: latest.filter((signal) => signal.permissionStatus === "granted").length,
        denied: latest.filter((signal) => signal.permissionStatus === "denied").length,
        withCoordinates: latest.filter((signal) => Number.isFinite(signal.latitude) && Number.isFinite(signal.longitude)).length,
      },
    };
  },
};

export type { LocationSignal };
