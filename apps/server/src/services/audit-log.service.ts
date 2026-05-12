import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { auditLogs } from "../db/schema.js";
import { generateId } from "../utils/id-generators.js";

type Actor = {
  id?: string;
  role?: string;
};

type AuditInput = {
  actor?: Actor | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

export const auditLogService = {
  async create(input: AuditInput) {
    const [row] = await db.insert(auditLogs).values({
      id: generateId("AUD"),
      actorUserId: input.actor?.id || null,
      actorRole: input.actor?.role || null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || null,
      summary: input.summary,
      metadata: input.metadata || {},
    }).returning();
    return row;
  },

  async getAll(filters: { entityType?: string; entityId?: string } = {}) {
    return db.query.auditLogs.findMany({
      ...(filters.entityType
        ? { where: filters.entityId ? and(eq(auditLogs.entityType, filters.entityType), eq(auditLogs.entityId, filters.entityId)) : eq(auditLogs.entityType, filters.entityType) }
        : {}),
      orderBy: (logs, { desc }) => [desc(logs.createdAt)],
      limit: 200,
    });
  },
};
