import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "../db/index.js";
import { clinicSettings } from "../db/schema.js";
import { centerClosureService } from "./center-closure.service.js";

const SYNC_VERSION_KEY = "system_revision";
const CLOSURE_MAINTENANCE_INTERVAL_MS = 60 * 1000;
let lastClosureMaintenanceAt = 0;
let closureMaintenancePromise: Promise<unknown> | null = null;

async function runClosureMaintenanceIfDue() {
  if (Date.now() - lastClosureMaintenanceAt < CLOSURE_MAINTENANCE_INTERVAL_MS) return;
  if (closureMaintenancePromise) return closureMaintenancePromise;
  lastClosureMaintenanceAt = Date.now();
  closureMaintenancePromise = centerClosureService.processDueAutomaticReplacements(5)
    .catch((error) => {
      console.error("[center-closures] automatic H-1 replacement maintenance failed", error);
    })
    .finally(() => {
      closureMaintenancePromise = null;
    });
  return closureMaintenancePromise;
}

function parseVersion(value: string | null | undefined, updatedAt?: Date | string | null) {
  if (value) {
    try {
      const parsed = JSON.parse(value);
      if (parsed?.version) {
        return {
          version: String(parsed.version),
          updatedAt: parsed.updatedAt || (updatedAt ? new Date(updatedAt).toISOString() : null),
          reason: parsed.reason || "",
        };
      }
    } catch {
      return {
        version: String(value),
        updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
        reason: "",
      };
    }
  }

  return {
    version: updatedAt ? new Date(updatedAt).toISOString() : "0",
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
    reason: "",
  };
}

export const syncService = {
  async getVersion() {
    await runClosureMaintenanceIfDue();
    const row = await db.query.clinicSettings.findFirst({
      where: eq(clinicSettings.key, SYNC_VERSION_KEY),
    });
    return parseVersion(row?.value, row?.updatedAt);
  },

  async bump(reason = "data_mutation") {
    const now = new Date();
    const payload = {
      version: `${now.getTime()}-${randomBytes(4).toString("hex")}`,
      updatedAt: now.toISOString(),
      reason,
    };

    await db.insert(clinicSettings)
      .values({
        key: SYNC_VERSION_KEY,
        value: JSON.stringify(payload),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: clinicSettings.key,
        set: {
          value: JSON.stringify(payload),
          updatedAt: now,
        },
      });

    return payload;
  },
};
