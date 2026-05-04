import { defineConfig } from "drizzle-kit";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  schema: path.resolve(__dirname, "src/db/schema.ts"),
  out: path.resolve(__dirname, "drizzle"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
