import { pool } from "../db/index.js";

type JsonRecord = Record<string, unknown>;

type NeonConfig = {
  apiBase: string;
  apiKey: string;
  projectId: string;
  branchId: string;
  dataTransferLimitGb: number;
  warnPercent: number;
  criticalPercent: number;
  backupBranchPrefix: string;
};

type DatabaseUsageStatus = "ok" | "warning" | "critical" | "over_limit" | "unknown" | "error";

const BYTES_PER_GB = 1024 ** 3;
const DEFAULT_DATA_TRANSFER_LIMIT_GB = 5;
const DEFAULT_WARN_PERCENT = 80;
const DEFAULT_CRITICAL_PERCENT = 90;
const DEFAULT_BACKUP_BRANCH_PREFIX = "backup/theracare";

export class DatabaseOperationsError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "DatabaseOperationsError";
    this.statusCode = statusCode;
  }
}

function readPositiveNumber(key: string, fallback: number) {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readConfig(): NeonConfig {
  return {
    apiBase: (process.env.NEON_API_BASE || "https://console.neon.tech/api/v2").replace(/\/+$/, ""),
    apiKey: process.env.NEON_API_KEY?.trim() || "",
    projectId: process.env.NEON_PROJECT_ID?.trim() || "",
    branchId: process.env.NEON_BRANCH_ID?.trim() || "",
    dataTransferLimitGb: readPositiveNumber("NEON_DATA_TRANSFER_LIMIT_GB", DEFAULT_DATA_TRANSFER_LIMIT_GB),
    warnPercent: readPositiveNumber("NEON_USAGE_WARN_PERCENT", DEFAULT_WARN_PERCENT),
    criticalPercent: readPositiveNumber("NEON_USAGE_CRITICAL_PERCENT", DEFAULT_CRITICAL_PERCENT),
    backupBranchPrefix: process.env.NEON_BACKUP_BRANCH_PREFIX?.trim() || DEFAULT_BACKUP_BRANCH_PREFIX,
  };
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function getRecord(value: unknown, key: string): JsonRecord {
  return asRecord(asRecord(value)[key]);
}

function getArray(value: unknown, key: string): JsonRecord[] {
  const rows = asRecord(value)[key];
  return Array.isArray(rows) ? rows.map(asRecord) : [];
}

function getString(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function getNumber(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function usageStatus(percent: number | null, warnPercent: number, criticalPercent: number): DatabaseUsageStatus {
  if (percent === null) return "unknown";
  if (percent >= 100) return "over_limit";
  if (percent >= criticalPercent) return "critical";
  if (percent >= warnPercent) return "warning";
  return "ok";
}

function buildRecommendations(status: DatabaseUsageStatus) {
  if (status === "over_limit") {
    return [
      "Hentikan aktivitas non-kritis sampai quota reset atau DB dipindahkan.",
      "Jangan jalankan backup dump besar dari aplikasi saat project sudah limit.",
    ];
  }
  if (status === "critical") {
    return [
      "Buat backup branch sekarang sebelum Neon masuk suspend.",
      "Kurangi penggunaan dashboard real-time dan hindari refresh berulang.",
    ];
  }
  if (status === "warning") {
    return [
      "Buat backup branch bila data hari ini sudah penting.",
      "Pantau penggunaan lebih sering sampai quota reset berikutnya.",
    ];
  }
  if (status === "unknown") {
    return [
      "Lengkapi NEON_API_KEY dan NEON_PROJECT_ID di env backend agar usage bisa dibaca.",
      "Cek dashboard Neon langsung sampai integrasi monitor aktif.",
    ];
  }
  if (status === "error") {
    return [
      "Periksa konfigurasi Neon API key/project id di backend.",
      "Gunakan script monitor lokal sebagai fallback sementara.",
    ];
  }
  return [
    "Lanjutkan monitoring berkala.",
    "Backup branch cukup dilakukan saat mendekati batas atau sebelum perubahan besar.",
  ];
}

function sanitizeBranchName(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9/_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "")
    .slice(0, 63);
}

function generatedBackupBranchName(prefix: string) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const safePrefix = sanitizeBranchName(prefix) || DEFAULT_BACKUP_BRANCH_PREFIX;
  return `${safePrefix}-${timestamp}`;
}

async function neonRequest(config: NeonConfig, path: string, init: RequestInit = {}) {
  if (!config.apiKey || !config.projectId) {
    throw new DatabaseOperationsError("Neon monitor belum dikonfigurasi di backend", 503);
  }

  const response = await fetch(`${config.apiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }

  if (!response.ok) {
    const record = asRecord(payload);
    const message = getString(record, "message")
      || getString(record, "error")
      || `Neon API request failed with status ${response.status}`;
    throw new DatabaseOperationsError(message, response.status >= 500 ? 502 : response.status);
  }

  return payload;
}

async function getProject(config: NeonConfig) {
  const payload = await neonRequest(config, `/projects/${encodeURIComponent(config.projectId)}`);
  const project = getRecord(payload, "project");
  return Object.keys(project).length > 0 ? project : asRecord(payload);
}

async function getBranches(config: NeonConfig) {
  const payload = await neonRequest(config, `/projects/${encodeURIComponent(config.projectId)}/branches`);
  return getArray(payload, "branches");
}

async function getDefaultBranch(config: NeonConfig) {
  const branches = await getBranches(config);
  if (config.branchId) {
    const configured = branches.find((branch) => getString(branch, "id") === config.branchId || getString(branch, "name") === config.branchId);
    if (configured) return configured;
  }
  return branches.find((branch) => branch.default === true)
    || branches.find((branch) => branch.primary === true)
    || branches.find((branch) => getString(branch, "current_state") === "ready")
    || branches[0]
    || {};
}

async function checkDatabaseHealth() {
  try {
    await pool.query("select 1");
    return { status: "ok", checkedAt: new Date().toISOString() };
  } catch (error: any) {
    return {
      status: "unavailable",
      code: error?.code || error?.name || "DB_ERROR",
      message: process.env.NODE_ENV === "development" ? error?.message : undefined,
      checkedAt: new Date().toISOString(),
    };
  }
}

export const databaseOperationsService = {
  async getUsage() {
    const config = readConfig();
    const limitBytes = config.dataTransferLimitGb * BYTES_PER_GB;
    const checkedAt = new Date().toISOString();
    const configured = Boolean(config.apiKey && config.projectId);

    if (!configured) {
      return {
        configured: false,
        status: "unknown" as DatabaseUsageStatus,
        projectId: config.projectId || null,
        projectName: null,
        dataTransferBytes: null,
        dataTransferGb: null,
        dataTransferLimitGb: config.dataTransferLimitGb,
        usagePercent: null,
        warnPercent: config.warnPercent,
        criticalPercent: config.criticalPercent,
        quotaResetAtUtc: null,
        consumptionPeriodStartUtc: null,
        consumptionPeriodEndUtc: null,
        storageBytes: null,
        databaseHealth: await checkDatabaseHealth(),
        actions: {
          backupAvailable: false,
          backupReason: "Set NEON_API_KEY dan NEON_PROJECT_ID di env backend terlebih dahulu.",
        },
        recommendations: buildRecommendations("unknown"),
        checkedAt,
      };
    }

    try {
      const [project, defaultBranch, databaseHealth] = await Promise.all([
        getProject(config),
        getDefaultBranch(config).catch(() => ({})),
        checkDatabaseHealth(),
      ]);
      const dataTransferBytes = getNumber(project, ["data_transfer_bytes", "dataTransferBytes"]);
      const percent = dataTransferBytes === null ? null : Math.round((dataTransferBytes / limitBytes) * 10000) / 100;
      const status = usageStatus(percent, config.warnPercent, config.criticalPercent);
      const branchState = getString(defaultBranch, "current_state");

      return {
        configured: true,
        status,
        projectId: getString(project, "id") || config.projectId,
        projectName: getString(project, "name") || null,
        branchId: getString(defaultBranch, "id") || null,
        branchName: getString(defaultBranch, "name") || null,
        branchState: branchState || null,
        dataTransferBytes,
        dataTransferGb: dataTransferBytes === null ? null : Math.round((dataTransferBytes / BYTES_PER_GB) * 1000) / 1000,
        dataTransferLimitGb: config.dataTransferLimitGb,
        usagePercent: percent,
        warnPercent: config.warnPercent,
        criticalPercent: config.criticalPercent,
        quotaResetAtUtc: getString(project, "quota_reset_at") || getString(project, "consumption_period_end") || null,
        consumptionPeriodStartUtc: getString(project, "consumption_period_start") || null,
        consumptionPeriodEndUtc: getString(project, "consumption_period_end") || null,
        storageBytes: getNumber(project, ["synthetic_storage_size", "storage_bytes"]),
        branchLogicalSizeLimitBytes: getNumber(project, ["branch_logical_size_limit_bytes"]),
        databaseHealth,
        actions: {
          backupAvailable: branchState ? branchState === "ready" : true,
          backupReason: branchState && branchState !== "ready" ? `Branch default Neon belum ready (${branchState}).` : null,
        },
        recommendations: buildRecommendations(status),
        checkedAt,
      };
    } catch (error: any) {
      return {
        configured: true,
        status: "error" as DatabaseUsageStatus,
        projectId: config.projectId,
        projectName: null,
        dataTransferBytes: null,
        dataTransferGb: null,
        dataTransferLimitGb: config.dataTransferLimitGb,
        usagePercent: null,
        warnPercent: config.warnPercent,
        criticalPercent: config.criticalPercent,
        quotaResetAtUtc: null,
        consumptionPeriodStartUtc: null,
        consumptionPeriodEndUtc: null,
        storageBytes: null,
        databaseHealth: await checkDatabaseHealth(),
        actions: {
          backupAvailable: false,
          backupReason: "Neon API tidak bisa dibaca dari backend.",
        },
        recommendations: buildRecommendations("error"),
        error: error?.message || "Neon usage check failed",
        checkedAt,
      };
    }
  },

  async createBackupBranch(input: { name?: string } = {}) {
    const config = readConfig();
    if (!config.apiKey || !config.projectId) {
      throw new DatabaseOperationsError("NEON_API_KEY dan NEON_PROJECT_ID wajib dikonfigurasi sebelum backup.", 503);
    }

    const parentBranch = await getDefaultBranch(config);
    const parentId = getString(parentBranch, "id");
    if (!parentId) {
      throw new DatabaseOperationsError("Branch default Neon tidak ditemukan.", 502);
    }

    const requestedName = typeof input.name === "string" ? sanitizeBranchName(input.name) : "";
    const branchName = requestedName || generatedBackupBranchName(config.backupBranchPrefix);
    const payload = await neonRequest(config, `/projects/${encodeURIComponent(config.projectId)}/branches`, {
      method: "POST",
      body: JSON.stringify({
        branch: {
          name: branchName,
          parent_id: parentId,
        },
        endpoints: [],
      }),
    });
    const branch = getRecord(payload, "branch");
    const createdBranch = Object.keys(branch).length > 0 ? branch : asRecord(payload);

    return {
      projectId: config.projectId,
      branchId: getString(createdBranch, "id") || null,
      branchName: getString(createdBranch, "name") || branchName,
      parentBranchId: parentId,
      parentBranchName: getString(parentBranch, "name") || null,
      currentState: getString(createdBranch, "current_state") || null,
      createdAt: getString(createdBranch, "created_at") || new Date().toISOString(),
      operationIds: getArray(payload, "operations").map((operation) => getString(operation, "id")).filter(Boolean),
    };
  },
};
