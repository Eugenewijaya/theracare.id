import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
import "dotenv/config";

function parsePoolMax(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

const isServerlessRuntime = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
const poolMax = parsePoolMax(process.env.PG_POOL_MAX, isServerlessRuntime ? 3 : 10);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
  max: poolMax,
  idleTimeoutMillis: isServerlessRuntime ? 10_000 : 30_000,
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: isServerlessRuntime,
});

export const db = drizzle(pool, { schema });
export { pool };
