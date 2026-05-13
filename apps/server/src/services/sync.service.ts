import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicSettings } from "../db/schema.js";

const SYNC_VERSION_KEY = "system_revision";

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
    const row = await db.query.clinicSettings.findFirst({
      where: eq(clinicSettings.key, SYNC_VERSION_KEY),
    });
    return parseVersion(row?.value, row?.updatedAt);
  },

  async bump(reason = "data_mutation") {
    const now = new Date();
    const payload = {
      version: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
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
