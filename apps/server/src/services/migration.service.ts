import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  children,
  historicalSessionSummaries,
  migrationBatches,
  migrationRecords,
  parents,
  programs,
  rooms,
  therapists,
  therapyPeriods,
} from "../db/schema.js";
import { generateId } from "../utils/id-generators.js";
import { httpError } from "../utils/http-error.js";
import { auditLogService } from "./audit-log.service.js";
import { childService } from "./child.service.js";
import { notificationService } from "./notification.service.js";
import { parentService } from "./parent.service.js";
import { therapyPeriodService } from "./therapy-period.service.js";

type Actor = { id?: string; role?: string } | null | undefined;
type MigrationRow = Record<string, unknown>;

const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  minggu: 0,
  senin: 1,
  monday: 1,
  selasa: 2,
  tuesday: 2,
  rabu: 3,
  wednesday: 3,
  kamis: 4,
  thursday: 4,
  jumat: 5,
  friday: 5,
  sabtu: 6,
  saturday: 6,
};

const DAY_NAME: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

const FIELD_ALIASES: Record<string, string[]> = {
  parentId: ["parentId", "parent id", "id orang tua", "id wali"],
  parentName: ["parentName", "parent name", "nama orang tua", "nama ortu", "nama wali", "wali"],
  parentPhone: ["parentPhone", "phone", "nomor hp", "no hp", "hp orang tua", "telepon", "whatsapp"],
  parentEmail: ["parentEmail", "email", "email orang tua"],
  parentAddress: ["parentAddress", "address", "alamat", "alamat orang tua"],
  childId: ["childId", "child id", "nita", "id anak"],
  childName: ["childName", "child name", "nama anak", "anak"],
  childDob: ["childDob", "dob", "tanggal lahir", "tgl lahir", "date of birth"],
  childGender: ["childGender", "gender", "jenis kelamin"],
  diagnosis: ["diagnosis", "diagnosa", "kondisi"],
  school: ["school", "sekolah"],
  programId: ["programId", "program id", "kode program", "id program"],
  programName: ["programName", "program", "layanan", "jenis terapi", "program terapi"],
  goals: ["goals", "goal", "iep", "iep goals", "tujuan", "target", "sasaran"],
  baseline: ["baseline", "kondisi awal", "catatan iep"],
  totalSessions: ["totalSessions", "total sesi", "jumlah sesi", "paket sesi", "kontrak sesi"],
  completedSessions: ["completedSessions", "sesi selesai", "sesi berjalan", "sesi sudah berjalan", "opening balance"],
  startDate: ["startDate", "tanggal mulai", "mulai terapi", "periode mulai"],
  endDate: ["endDate", "tanggal akhir", "selesai terapi", "periode akhir"],
  firstKnownDate: ["firstKnownDate", "tanggal sesi pertama", "first known date"],
  lastKnownDate: ["lastKnownDate", "tanggal sesi terakhir", "last known date"],
  therapistId: ["therapistId", "terapis utama id", "terapis utama", "primary therapist", "nit terapis"],
  assistantTherapistId: ["assistantTherapistId", "terapis pendamping id", "terapis pendamping", "assistant therapist"],
  scheduleDay: ["scheduleDay", "hari", "hari terapi", "jadwal hari"],
  startTime: ["startTime", "jam", "jam mulai", "waktu mulai"],
  duration: ["duration", "durasi", "menit"],
  roomId: ["roomId", "ruangan", "room", "ruang"],
  notes: ["notes", "catatan", "note"],
  sourceNote: ["sourceNote", "sumber catatan", "keterangan sumber"],
};

function normalizeKey(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function normalizeEmail(value: unknown) {
  return cleanText(value).toLowerCase();
}

function normalizePhone(value: unknown) {
  const digits = cleanText(value).replace(/\D/g, "");
  if (digits.startsWith("62")) return `0${digits.slice(2)}`;
  if (digits.startsWith("8")) return `0${digits}`;
  return digits;
}

function readField(row: MigrationRow, field: keyof typeof FIELD_ALIASES) {
  const lookup = new Map<string, unknown>();
  Object.entries(row || {}).forEach(([key, value]) => lookup.set(normalizeKey(key), value));
  for (const alias of FIELD_ALIASES[field]) {
    const value = lookup.get(normalizeKey(alias));
    if (value !== undefined && cleanText(value)) return cleanText(value);
  }
  return "";
}

function toPositiveInt(value: unknown) {
  const parsed = Number.parseInt(cleanText(value).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toIsoDate(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 20_000 && numeric < 90_000) {
    const date = new Date(Date.UTC(1899, 11, 30) + numeric * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  }

  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slash) {
    const day = slash[1].padStart(2, "0");
    const month = slash[2].padStart(2, "0");
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    const date = new Date(`${year}-${month}-${day}T00:00:00`);
    if (!Number.isNaN(date.getTime())) return `${year}-${month}-${day}`;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function toTime(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2] || "0");
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function splitList(value: unknown) {
  return cleanText(value)
    .split(/\r?\n|;|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

function parseDelimitedText(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const delimiter = ["\t", ";", ","]
    .map((candidate) => ({ candidate, count: lines[0].split(candidate).length }))
    .sort((a, b) => b.count - a.count)[0].candidate;
  const parseLine = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && quoted && next === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  };
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line, index) => {
    const values = parseLine(line);
    return headers.reduce((row, header, cellIndex) => ({
      ...row,
      [header || `column_${cellIndex + 1}`]: values[cellIndex] || "",
      __rowNumber: index + 2,
    }), {} as MigrationRow);
  });
}

function buildRows(input: any): MigrationRow[] {
  if (Array.isArray(input?.rows)) return input.rows.filter((row: unknown): row is MigrationRow => !!row && typeof row === "object" && !Array.isArray(row));
  if (typeof input?.text === "string") return parseDelimitedText(input.text);
  return [];
}

function addRef(refs: Map<string, any>, key: unknown, value: any) {
  const normalized = normalizeKey(key);
  if (normalized && !refs.has(normalized)) refs.set(normalized, value);
}

async function loadReferences() {
  const [therapistRows, programRows, roomRows] = await Promise.all([
    db.query.therapists.findMany({ with: { user: true } }),
    db.query.programs.findMany(),
    db.query.rooms.findMany(),
  ]);
  const therapistRefs = new Map<string, any>();
  therapistRows.forEach((therapist) => {
    addRef(therapistRefs, therapist.id, therapist);
    addRef(therapistRefs, therapist.nit, therapist);
    addRef(therapistRefs, therapist.user?.name, therapist);
    addRef(therapistRefs, therapist.user?.email, therapist);
  });

  const programRefs = new Map<string, any>();
  programRows.forEach((program) => {
    addRef(programRefs, program.id, program);
    addRef(programRefs, program.code, program);
    addRef(programRefs, program.name, program);
  });

  const roomRefs = new Map<string, any>();
  roomRows.forEach((room) => {
    addRef(roomRefs, room.id, room);
    addRef(roomRefs, room.name, room);
  });

  return { therapistRefs, programRefs, roomRefs };
}

function resolveRef(refs: Map<string, any>, value: string) {
  return value ? refs.get(normalizeKey(value)) || null : null;
}

function buildScheduleRules(row: MigrationRow, refs: Awaited<ReturnType<typeof loadReferences>>, therapistId: string, errors: string[], warnings: string[]) {
  const dayInput = readField(row, "scheduleDay");
  if (!dayInput) return [];

  const startTime = toTime(readField(row, "startTime"));
  if (!startTime) errors.push("Jam mulai wajib diisi jika hari terapi diisi.");

  const durationMinutes = toPositiveInt(readField(row, "duration")) || 60;
  const roomInput = readField(row, "roomId");
  const room = resolveRef(refs.roomRefs, roomInput);
  if (roomInput && !room) warnings.push(`Ruangan "${roomInput}" belum ditemukan; jadwal tetap dibuat tanpa roomId.`);

  return splitList(dayInput)
    .map((day) => {
      const dayOfWeek = DAY_INDEX[normalizeKey(day)];
      if (dayOfWeek === undefined) {
        warnings.push(`Hari terapi "${day}" tidak dikenali.`);
        return null;
      }
      return {
        day: DAY_NAME[dayOfWeek],
        dayOfWeek,
        startTime: startTime || "09:00",
        duration: `${durationMinutes} mins`,
        therapistId,
        ...(room?.id ? { roomId: room.id } : {}),
      };
    })
    .filter(Boolean);
}

function normalizeMigrationRow(row: MigrationRow, index: number, refs: Awaited<ReturnType<typeof loadReferences>>) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rowNumber = Number(row.__rowNumber || index + 2);

  const parentName = readField(row, "parentName");
  const parentPhone = normalizePhone(readField(row, "parentPhone"));
  const parentEmail = normalizeEmail(readField(row, "parentEmail"));
  const parentId = readField(row, "parentId");
  if (!parentName && !parentId) errors.push("Nama orang tua/wali atau parentId wajib diisi.");
  if (!parentPhone && !parentEmail && !parentId) errors.push("Nomor HP atau email orang tua wajib diisi.");

  const childId = readField(row, "childId");
  const childName = readField(row, "childName");
  const nameParts = splitName(childName);
  if (!childId && !childName) errors.push("Nama anak atau NITA/childId wajib diisi.");

  const programInput = readField(row, "programId") || readField(row, "programName");
  const program = resolveRef(refs.programRefs, programInput);
  const programName = program?.name || readField(row, "programName") || programInput;
  if (!programName) errors.push("Program/layanan terapi wajib diisi.");
  if (programInput && !program) warnings.push(`Program "${programInput}" belum ada di master; akan dibuat sebagai tipe program legacy.`);

  const therapistInput = readField(row, "therapistId");
  const therapist = resolveRef(refs.therapistRefs, therapistInput);
  if (!therapistInput) errors.push("Terapis utama wajib diisi untuk periode berjalan.");
  if (therapistInput && !therapist) errors.push(`Terapis utama "${therapistInput}" tidak ditemukan.`);
  if (!readField(row, "scheduleDay")) errors.push("Hari terapi aktif wajib diisi agar terapis utama tetap terlacak.");

  const assistantInput = readField(row, "assistantTherapistId");
  const assistant = resolveRef(refs.therapistRefs, assistantInput);
  if (assistantInput && !assistant) warnings.push(`Terapis pendamping "${assistantInput}" tidak ditemukan dan tidak akan ditautkan.`);

  const totalSessions = toPositiveInt(readField(row, "totalSessions"));
  const completedSessions = toPositiveInt(readField(row, "completedSessions")) || 0;
  if (!totalSessions || totalSessions <= 0) errors.push("Total sesi paket wajib lebih dari 0.");
  if (totalSessions && completedSessions > totalSessions) errors.push("Sesi sudah berjalan tidak boleh lebih besar dari total sesi.");

  const startDate = toIsoDate(readField(row, "startDate"));
  const endDate = toIsoDate(readField(row, "endDate"));
  const firstKnownDate = toIsoDate(readField(row, "firstKnownDate")) || startDate;
  const lastKnownDate = toIsoDate(readField(row, "lastKnownDate")) || firstKnownDate || startDate;
  if (!startDate) errors.push("Tanggal mulai periode wajib diisi.");
  if (endDate && startDate && endDate < startDate) errors.push("Tanggal akhir periode tidak boleh lebih awal dari tanggal mulai.");

  const goals = splitList(readField(row, "goals"));
  const baseline = readField(row, "baseline");
  const notes = readField(row, "notes");
  const sourceNote = readField(row, "sourceNote") || "Migrasi awal center manual/semi-manual.";
  const therapistId = therapist?.id || therapistInput;
  const scheduleRules = buildScheduleRules(row, refs, therapist?.id || "", errors, warnings);
  const confidence = Math.max(0, Math.min(100, 100 - errors.length * 35 - warnings.length * 10));

  return {
    rowNumber,
    status: errors.length ? "needs_review" : "ready",
    confidence,
    errors,
    warnings,
    normalizedData: {
      parent: {
        id: parentId,
        name: parentName,
        phone: parentPhone,
        email: parentEmail,
        address: readField(row, "parentAddress"),
      },
      child: {
        id: childId,
        name: childName,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        dob: toIsoDate(readField(row, "childDob")),
        gender: readField(row, "childGender"),
        diagnosis: readField(row, "diagnosis"),
        school: readField(row, "school"),
      },
      program: {
        programId: program?.id || "",
        type: programName || "Program Terapi",
        goals,
        baseline,
      },
      period: {
        startDate,
        endDate: endDate || null,
        totalSessions: totalSessions || 0,
        completedSessions,
        therapistId,
        assistantTherapistIds: assistant?.id ? [assistant.id] : [],
        scheduleRules,
        notes: [notes, baseline ? `Baseline IEP: ${baseline}` : "", `Sumber migrasi: ${sourceNote}`]
          .filter(Boolean)
          .join("\n"),
      },
      historicalSummary: {
        completedCount: completedSessions,
        firstKnownDate: firstKnownDate || startDate,
        lastKnownDate: lastKnownDate || firstKnownDate || startDate,
        sourceNote,
      },
    },
  };
}

async function getBatchWithRecords(batchId: string) {
  const batch = await db.query.migrationBatches.findFirst({
    where: eq(migrationBatches.id, batchId),
    with: {
      creator: true,
      records: true,
      historicalSummaries: true,
    },
  });
  if (!batch) return null;
  const records = [...(batch.records || [])].sort((a, b) => Number(a.rowNumber || 0) - Number(b.rowNumber || 0));
  return {
    ...batch,
    records,
    summary: {
      ...(batch.summary || {}),
      totalRows: records.length,
      readyRows: records.filter((record) => record.status === "ready").length,
      blockedRows: records.filter((record) => record.status === "needs_review").length,
      appliedRows: records.filter((record) => record.status === "applied").length,
      failedRows: records.filter((record) => record.status === "failed").length,
    },
  };
}

async function findExistingParent(data: any) {
  if (data.id) {
    const parent = await db.query.parents.findFirst({ where: eq(parents.id, data.id), with: { user: true, children: true } });
    if (parent) return parent;
  }
  const rows = await db.query.parents.findMany({ with: { user: true, children: true } });
  const phone = normalizePhone(data.phone);
  const email = normalizeEmail(data.email);
  return rows.find((parent) => (
    (phone && normalizePhone(parent.user?.phone || "") === phone)
    || (email && normalizeEmail(parent.user?.email || "") === email)
  )) || null;
}

async function findOrCreateParent(data: any) {
  const existing = await findExistingParent(data);
  if (existing) return { parent: existing, created: false, tempPassword: "" };
  const lastId = await parentService.getLastId();
  const created = await parentService.create({
    name: data.name || "Orang Tua",
    email: data.email || "",
    phone: data.phone || "",
    address: data.address || "",
  }, lastId);
  return { parent: created.parent, created: true, tempPassword: created.tempPassword };
}

async function findExistingChild(parentId: string, data: any) {
  if (data.id) {
    const child = await db.query.children.findFirst({ where: eq(children.id, data.id) });
    if (child && child.parentId !== parentId) {
      throw httpError(409, `Child ${data.id} sudah terhubung ke parent lain.`);
    }
    if (child) return child;
  }
  const wantedName = normalizeKey(data.name || `${data.firstName || ""} ${data.lastName || ""}`);
  if (!wantedName) return null;
  const rows = await db.query.children.findMany({ where: eq(children.parentId, parentId) });
  return rows.find((child) => normalizeKey(child.name || `${child.firstName || ""} ${child.lastName || ""}`) === wantedName) || null;
}

async function findOrCreateChild(parentId: string, data: any, programData: any, periodData: any) {
  const existing = await findExistingChild(parentId, data);
  if (existing) return { child: existing, created: false };
  const child = await childService.create(parentId, {
    firstName: data.firstName || data.name || "Anak",
    lastName: data.lastName || "",
    dob: data.dob || undefined,
    gender: data.gender || undefined,
    school: data.school || undefined,
    diagnosis: data.diagnosis || undefined,
    therapyProgramsList: [{
      programId: programData?.programId || undefined,
      type: programData?.type || "Program Terapi",
      totalSessions: Number(periodData?.totalSessions || 1),
      goal: Array.isArray(programData?.goals) ? programData.goals[0] || "" : "",
      createInitialPeriod: false,
    }],
  });
  return { child, created: true };
}

async function applyRecord(record: typeof migrationRecords.$inferSelect, batchId: string, actor: Actor) {
  const data: any = record.normalizedData || {};
  const parentResult = await findOrCreateParent(data.parent || {});
  const periodInput = data.period || {};
  const programInput = data.program || {};
  const summaryInput = data.historicalSummary || {};
  const childResult = await findOrCreateChild(parentResult.parent.id, data.child || {}, programInput, periodInput);
  const period = await therapyPeriodService.create({
    childId: childResult.child.id,
    programId: programInput.programId || undefined,
    type: programInput.type || "Program Terapi",
    goal: Array.isArray(programInput.goals) ? programInput.goals[0] || "" : "",
    goals: Array.isArray(programInput.goals) ? programInput.goals : [],
    startDate: periodInput.startDate,
    endDate: periodInput.endDate || undefined,
    totalSessions: Number(periodInput.totalSessions || 0),
    completedSessions: Number(periodInput.completedSessions || 0),
    scheduleRules: Array.isArray(periodInput.scheduleRules) ? periodInput.scheduleRules : [],
    assistantTherapistIds: Array.isArray(periodInput.assistantTherapistIds) ? periodInput.assistantTherapistIds : [],
    notes: periodInput.notes || "",
    generateSessions: false,
  });
  if (!period?.id) throw httpError(500, "Periode migrasi gagal dibuat.");

  const completedCount = Number(summaryInput.completedCount || 0);
  if (completedCount > 0) {
    await db.insert(historicalSessionSummaries).values({
      id: generateId("HIST"),
      migrationBatchId: batchId,
      childId: childResult.child.id,
      therapyPeriodId: period.id,
      completedCount,
      firstKnownDate: summaryInput.firstKnownDate || periodInput.startDate || null,
      lastKnownDate: summaryInput.lastKnownDate || summaryInput.firstKnownDate || periodInput.startDate || null,
      sourceNote: summaryInput.sourceNote || "Historical opening balance",
    });
  }

  await db.update(migrationRecords)
    .set({
      status: "applied",
      childId: childResult.child.id,
      therapyPeriodId: period.id,
      errors: [],
      updatedAt: new Date(),
    })
    .where(eq(migrationRecords.id, record.id));

  await auditLogService.create({
    actor,
    action: "migration.record.apply",
    entityType: "migration_record",
    entityId: record.id,
    summary: `Baris migrasi ${record.rowNumber} diterapkan untuk ${childResult.child.name || childResult.child.id}`,
    metadata: {
      batchId,
      childId: childResult.child.id,
      therapyPeriodId: period.id,
      parentCreated: parentResult.created,
      childCreated: childResult.created,
      historicalCompletedSessions: completedCount,
    },
  });

  return {
    recordId: record.id,
    childId: childResult.child.id,
    therapyPeriodId: period.id,
    parentCreated: parentResult.created,
    childCreated: childResult.created,
    tempParentPassword: parentResult.tempPassword || undefined,
  };
}

export const migrationService = {
  async dryRun(input: any, actor: Actor) {
    const rows = buildRows(input);
    if (rows.length === 0) throw httpError(400, "Import membutuhkan minimal satu baris data.");
    const refs = await loadReferences();
    const normalized = rows.map((row: MigrationRow, index: number) => normalizeMigrationRow(row, index, refs));
    const blockedRows = normalized.filter((record: any) => record.errors.length > 0).length;
    const batchId = generateId("MIG");
    const status = blockedRows > 0 ? "needs_review" : "dry_run";
    const summary = {
      totalRows: normalized.length,
      readyRows: normalized.length - blockedRows,
      blockedRows,
      sourceType: input?.sourceType || "excel_csv",
      fileName: input?.fileName || "",
    };

    await db.insert(migrationBatches).values({
      id: batchId,
      status,
      sourceType: input?.sourceType || "excel_csv",
      fileName: input?.fileName || null,
      createdBy: actor?.id || null,
      summary,
    });

    await db.insert(migrationRecords).values(normalized.map((record: any, index: number) => ({
      id: generateId("MREC"),
      batchId,
      status: record.status,
      rowNumber: record.rowNumber || index + 2,
      confidence: record.confidence,
      errors: record.errors,
      warnings: record.warnings,
      sourceSnapshot: rows[index],
      normalizedData: record.normalizedData,
    })));

    await auditLogService.create({
      actor,
      action: "migration.batch.dry_run",
      entityType: "migration_batch",
      entityId: batchId,
      summary: `Dry-run migrasi dibuat: ${summary.readyRows}/${summary.totalRows} baris siap`,
      metadata: summary,
    });

    return getBatchWithRecords(batchId);
  },

  async getBatch(batchId: string) {
    return getBatchWithRecords(batchId);
  },

  async applyBatch(batchId: string, actor: Actor) {
    const batch = await db.query.migrationBatches.findFirst({
      where: eq(migrationBatches.id, batchId),
      with: { records: true },
    });
    if (!batch) return null;
    if (batch.status === "applied") return getBatchWithRecords(batchId);

    const records = (batch.records || []).sort((a, b) => Number(a.rowNumber || 0) - Number(b.rowNumber || 0));
    const blocked = records.filter((record) => record.status === "needs_review" || (Array.isArray(record.errors) && record.errors.length > 0));
    if (blocked.length > 0) {
      throw httpError(409, "Batch masih memiliki baris yang perlu diperbaiki sebelum apply.", {
        blockedRows: blocked.map((record) => ({ id: record.id, rowNumber: record.rowNumber, errors: record.errors || [] })),
      });
    }

    const results: any[] = [];
    const failures: any[] = [];
    for (const record of records.filter((item) => item.status !== "applied")) {
      try {
        results.push(await applyRecord(record, batchId, actor));
      } catch (error: any) {
        failures.push({ recordId: record.id, rowNumber: record.rowNumber, error: error?.message || "Gagal menerapkan baris." });
        await db.update(migrationRecords)
          .set({ status: "failed", errors: [error?.message || "Gagal menerapkan baris."], updatedAt: new Date() })
          .where(eq(migrationRecords.id, record.id));
      }
    }

    const nextStatus = failures.length > 0 ? "partially_applied" : "applied";
    const summary = {
      ...(batch.summary || {}),
      appliedRows: results.length,
      failedRows: failures.length,
      failures,
    };
    await db.update(migrationBatches)
      .set({ status: nextStatus, summary, appliedAt: new Date(), updatedAt: new Date() })
      .where(eq(migrationBatches.id, batchId));

    await auditLogService.create({
      actor,
      action: "migration.batch.apply",
      entityType: "migration_batch",
      entityId: batchId,
      summary: `Batch migrasi diterapkan: ${results.length} berhasil, ${failures.length} gagal`,
      metadata: summary,
    });

    await notificationService.create({
      type: "migration_batch_applied",
      icon: "upload_file",
      title: "Migrasi data center selesai",
      message: `${results.length} data anak/periode berhasil diterapkan dari batch migrasi.`,
      targetRole: "admin",
      relatedId: batchId,
    });

    return getBatchWithRecords(batchId);
  },

  async manualIntake(input: any, actor: Actor) {
    const batch = await this.dryRun({
      sourceType: "manual_form",
      rows: [input],
      fileName: "manual-intake",
    }, actor);
    const record = batch?.records?.[0];
    if (!record || record.status === "needs_review") {
      throw httpError(400, "Data intake manual belum lengkap.", { errors: record?.errors || [] });
    }
    return this.applyBatch(batch.id, actor);
  },
};
