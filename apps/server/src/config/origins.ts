const LOCAL_DEV_ORIGIN = "http://localhost:5173";

const vercelOriginPattern = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;
const localhostOriginPattern = /^http:\/\/localhost:\d+$/i;

function splitOrigins(value?: string) {
  return (value || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

export function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, "");
}

export function getConfiguredOrigins() {
  const origins = [
    ...splitOrigins(process.env.CORS_ORIGIN),
    ...splitOrigins(process.env.ADMIN_APP_URL),
    ...splitOrigins(process.env.THERAPIST_APP_URL),
    ...splitOrigins(process.env.PARENT_APP_URL),
  ];

  return Array.from(new Set(origins.length > 0 ? origins : [LOCAL_DEV_ORIGIN]));
}

export function isAllowedOrigin(origin: string, configuredOrigins = getConfiguredOrigins()) {
  const normalized = normalizeOrigin(origin);
  return configuredOrigins.includes(normalized)
    || vercelOriginPattern.test(normalized)
    || localhostOriginPattern.test(normalized);
}

export function getTrustedOrigins() {
  return Array.from(new Set([
    ...getConfiguredOrigins(),
    "https://*.vercel.app",
    "http://localhost:*",
  ]));
}
