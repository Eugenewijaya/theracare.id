import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "./db/index.js";
import * as schema from "./db/schema.js";

const authBaseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const trustedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const isHttpsAuth = authBaseUrl.startsWith("https://");

export const auth = betterAuth({
  baseURL: authBaseUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.authSession,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      phone: { type: "string", required: false, input: true },
      role: { type: "string", required: false, defaultValue: "parent", input: true },
      status: { type: "string", required: false, defaultValue: "active", input: true },
    },
  },
  plugins: [admin()],
  trustedOrigins,
  advanced: {
    useSecureCookies: isHttpsAuth,
    ...(isHttpsAuth
      ? {
          defaultCookieAttributes: {
            sameSite: "none",
            secure: true,
            httpOnly: true,
          },
        }
      : {}),
  },
});
