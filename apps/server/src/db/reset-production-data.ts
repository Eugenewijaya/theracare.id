import "dotenv/config";
import { eq } from "drizzle-orm";
import type { PoolClient } from "pg";
import { auth } from "../auth.js";
import { db, pool } from "./index.js";
import { user } from "./schema.js";

const CONFIRM_VALUE = "RESET_THERACARE_PRODUCTION_DATA";

const DATA_TABLES = [
  "announcement_target_roles",
  "announcements",
  "notification_reads",
  "notifications",
  "historical_session_summaries",
  "migration_records",
  "migration_batches",
  "audit_logs",
  "session_ratings",
  "reschedule_requests",
  "reports",
  "therapy_sessions",
  "therapy_periods",
  "therapy_programs",
  "children",
  "parents",
  "therapists",
  "rooms",
  "programs",
  "verification",
  "session",
  "account",
  "user",
] as const;

const OPERATIONAL_SETTING_KEYS = [
  "therapistLeaveRequests",
  "childLeaveRequests",
  "parentMeetings",
  "substituteTherapistRequests",
  "centerClosures",
  "childPhotoUrls",
  "system_revision",
] as const;

const BRANDING_ASSET_SETTING_KEYS = [
  "logoUrl",
  "faviconUrl",
  "centerPhotoUrl",
] as const;

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

async function getExistingTables(client: PoolClient) {
  const result = await client.query<{ table_name: string }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name
    `,
    [DATA_TABLES]
  );
  return new Set(result.rows.map((row) => row.table_name));
}

async function tableExists(client: PoolClient, table: string) {
  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    [table]
  );
  return Boolean(result.rows[0]?.exists);
}

async function getCounts(client: PoolClient, tables: string[]) {
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const result = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${quoteIdent(table)}`);
    counts[table] = Number(result.rows[0]?.count || 0);
  }
  return counts;
}

async function createAdminIfConfigured() {
  const email = process.env.RESET_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "";
  const password = process.env.RESET_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";
  const name = process.env.RESET_ADMIN_NAME || process.env.ADMIN_NAME || "Admin TheraCare";
  const phone = process.env.RESET_ADMIN_PHONE || process.env.ADMIN_PHONE || null;

  if (!email || !password) {
    console.warn("Admin tidak dibuat karena RESET_ADMIN_EMAIL/RESET_ADMIN_PASSWORD belum diisi.");
    console.warn("Database sudah bersih. Jalankan script lagi dengan kredensial admin untuk membuat akun awal.");
    return;
  }

  await auth.api.signUpEmail({
    body: { email, password, name },
  });

  await db
    .update(user)
    .set({ role: "admin", status: "active", phone })
    .where(eq(user.email, email));

  console.log(`Admin awal dibuat: ${email}`);
}

async function main() {
  if (process.env.CONFIRM_RESET !== CONFIRM_VALUE) {
    throw new Error(`Reset dibatalkan. Set CONFIRM_RESET=${CONFIRM_VALUE} untuk menjalankan.`);
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL belum tersedia. Jalankan dari Vercel/Neon environment atau lokal dengan Neon DATABASE_URL.");
  }

  const resetSettings = process.env.RESET_CLINIC_SETTINGS === "true";
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(260515)");

    const existingTables = await getExistingTables(client);
    const tables = DATA_TABLES.filter((table) => existingTables.has(table));
    const before = await getCounts(client, tables);

    if (tables.length > 0) {
      await client.query(`TRUNCATE TABLE ${tables.map(quoteIdent).join(", ")} RESTART IDENTITY CASCADE`);
    }

    if (await tableExists(client, "clinic_settings")) {
      if (resetSettings) {
        await client.query(`TRUNCATE TABLE ${quoteIdent("clinic_settings")} RESTART IDENTITY CASCADE`);
      } else {
        await client.query(
          `DELETE FROM ${quoteIdent("clinic_settings")} WHERE key = ANY($1::text[])`,
          [OPERATIONAL_SETTING_KEYS]
        );
        if (process.env.RESET_BRANDING_ASSETS === "true") {
          await client.query(
            `
              INSERT INTO ${quoteIdent("clinic_settings")} (key, value, updated_at)
              SELECT unnest($1::text[]), '', now()
              ON CONFLICT (key) DO UPDATE
              SET value = excluded.value,
                  updated_at = excluded.updated_at
            `,
            [BRANDING_ASSET_SETTING_KEYS]
          );
        }
      }
    }

    const after = await getCounts(client, tables);
    await client.query("COMMIT");

    console.log("Reset data selesai.");
    console.table(tables.map((table) => ({ table, before: before[table], after: after[table] })));
    console.log(
      resetSettings
        ? "clinic_settings ikut dikosongkan."
        : "clinic_settings branding dipertahankan; key operasional percobaan sudah dibersihkan."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await createAdminIfConfigured();
  await pool.end();
}

main().catch(async (error) => {
  console.error("Reset data gagal:", error);
  await pool.end();
  process.exit(1);
});
