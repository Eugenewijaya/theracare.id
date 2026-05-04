import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "apps/server/src/db/schema.ts",
  out: "apps/server/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: "postgresql://neondb_owner:npg_TeNg8s7ftbcx@ep-jolly-night-ao6ngrb6-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
  },
});
