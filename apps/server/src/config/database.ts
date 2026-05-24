const DATABASE_URL_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
] as const;

export function getDatabaseUrl() {
  for (const key of DATABASE_URL_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

export function hasDatabaseUrl() {
  return Boolean(getDatabaseUrl());
}

export function getDatabaseEnvKey() {
  for (const key of DATABASE_URL_KEYS) {
    if (process.env[key]?.trim()) return key;
  }
  return "";
}

export function shouldUseExplicitSsl(databaseUrl = getDatabaseUrl()) {
  if (!databaseUrl) return false;
  return !/[?&]sslmode=/i.test(databaseUrl) && !/[?&]ssl=/i.test(databaseUrl);
}
