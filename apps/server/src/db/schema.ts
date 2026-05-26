import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  date,
  jsonb,
  primaryKey,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ══════════════════════════════════════════════════════════════════
// Better Auth Core Tables
// ══════════════════════════════════════════════════════════════════

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // ── Better Auth admin plugin fields ──
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  // ── Custom fields ──
  phone: varchar("phone", { length: 20 }),
  role: text("role").notNull().default("parent"), // admin | parent | therapist
  status: text("status").notNull().default("active"), // active | suspended
});

export const authSession = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ══════════════════════════════════════════════════════════════════
// Application Tables
// ══════════════════════════════════════════════════════════════════

// ── Parents ────────────────────────────────────────────────────────

export const parents = pgTable("parents", {
  id: text("id").primaryKey(), // P-0001
  userId: text("user_id")
    .notNull()
    .references(() => user.id)
    .unique(),
  address: text("address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Therapists ─────────────────────────────────────────────────────

export const therapists = pgTable("therapists", {
  id: text("id").primaryKey(), // NIT — e.g. SARAH260411001
  userId: text("user_id")
    .notNull()
    .references(() => user.id)
    .unique(),
  nit: varchar("nit", { length: 30 }).notNull().unique(),
  specialty: text("specialty"),
  bio: text("bio"),
  avatar: text("avatar"),
  educationLevel: text("education_level"),
  educationField: text("education_field"),
  educationInstitution: text("education_institution"),
  graduationYear: varchar("graduation_year", { length: 4 }),
  strNumber: text("str_number"),
  strExpiry: date("str_expiry"),
  yearsExperience: text("years_experience"),
  languages: text("languages"),
  certifications: jsonb("certifications").$type<Array<Record<string, unknown>>>(),
  schedule: jsonb("schedule").$type<Record<string, { start?: string; end?: string }>>(),
  primaryRoom: text("primary_room"),
  maxClients: integer("max_clients"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Children ───────────────────────────────────────────────────────

export const children = pgTable("children", {
  id: text("id").primaryKey(), // NITA — e.g. 260416001
  nita: varchar("nita", { length: 20 }).notNull().unique(),
  parentId: text("parent_id")
    .notNull()
    .references(() => parents.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  name: text("name").notNull(), // Computed: firstName + lastName
  dob: date("dob"),
  gender: text("gender"), // male | female
  school: text("school"),
  diagnosis: text("diagnosis"),
  status: text("status").notNull().default("active"), // active | inactive
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Programs (Clinic-defined therapy types) ────────────────────────

export const programs = pgTable("programs", {
  id: text("id").primaryKey(), // PRG-OT
  name: text("name").notNull(),
  code: varchar("code", { length: 10 }).unique(),
  target: text("target"),
  duration: integer("duration"), // default session duration in minutes
  goals: jsonb("goals").$type<string[]>(), // array of goal strings
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Therapy Programs (Child enrollment in programs) ────────────────

export const therapyPrograms = pgTable("therapy_programs", {
  id: serial("id").primaryKey(),
  childId: text("child_id")
    .notNull()
    .references(() => children.id),
  programId: text("program_id").references(() => programs.id),
  type: text("type").notNull(), // e.g. "Occupational Therapy (OT)"
  sessionsCompleted: integer("sessions_completed").notNull().default(0),
  totalSessions: integer("total_sessions").notNull(),
  goal: text("goal"),
  icon: text("icon"),
  colorClass: text("color_class"),
  colorHex: text("color_hex"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Therapy Periods (per-program enrollment periods / seasons)

export const therapyPeriods = pgTable("therapy_periods", {
  id: text("id").primaryKey(),
  childId: text("child_id")
    .notNull()
    .references(() => children.id),
  therapyProgramId: integer("therapy_program_id").references(() => therapyPrograms.id),
  programId: text("program_id").references(() => programs.id),
  periodNumber: integer("period_number").notNull().default(1),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"), // planned | active | completed | cancelled
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  totalSessions: integer("total_sessions").notNull().default(0),
  completedSessions: integer("completed_sessions").notNull().default(0),
  pricePerSession: integer("price_per_session").notNull().default(0),
  pricePerMonth: integer("price_per_month").notNull().default(0),
  totalPrice: integer("total_price").notNull().default(0),
  billingMode: text("billing_mode").notNull().default("per_session"), // per_session | per_month | package
  scheduleRules: jsonb("schedule_rules").$type<Array<{
    day: string;
    dayOfWeek: number;
    startTime: string;
    duration?: string;
    therapistId?: string;
    roomId?: string;
  }>>(),
  assistantTherapistIds: jsonb("assistant_therapist_ids").$type<string[]>(),
  goals: jsonb("goals").$type<string[]>(),
  notes: text("notes"),
  renewalOf: text("renewal_of"),
  finalReportId: text("final_report_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Rooms ──────────────────────────────────────────────────────────

export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(), // RM-001
  name: text("name").notNull(),
  type: text("type"),
  capacity: integer("capacity").notNull().default(1),
  status: text("status").notNull().default("active"), // active | inactive
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Therapy Sessions ───────────────────────────────────────────────

export const therapySessions = pgTable("therapy_sessions", {
  id: text("id").primaryKey(), // S-001
  therapyPeriodId: text("therapy_period_id").references(() => therapyPeriods.id),
  therapistId: text("therapist_id")
    .notNull()
    .references(() => therapists.id),
  childId: text("child_id")
    .notNull()
    .references(() => children.id),
  roomId: text("room_id").references(() => rooms.id),
  date: date("date").notNull(),
  startTime: varchar("start_time", { length: 5 }).notNull(), // HH:MM
  duration: varchar("duration", { length: 20 }).default("60 mins"),
  focus: text("focus"),
  status: text("status").notNull().default("upcoming"), // upcoming | confirmed | active | done | cancelled
  notes: text("notes"),
  cancelReason: text("cancel_reason"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Reports ────────────────────────────────────────────────────────

export const reports = pgTable("reports", {
  id: text("id").primaryKey(), // REP-0001
  type: text("type").notNull(), // harian | periodik | observasi_awal
  therapyPeriodId: text("therapy_period_id").references(() => therapyPeriods.id),
  childId: text("child_id")
    .notNull()
    .references(() => children.id),
  therapistId: text("therapist_id")
    .notNull()
    .references(() => therapists.id),
  sessionId: text("session_id").references(() => therapySessions.id),
  status: text("status").notNull().default("pending_review"),
  // Daily report fields
  date: date("date"),
  sessionFocus: text("session_focus"),
  sessionType: text("session_type"),
  aspects: jsonb("aspects").$type<string[]>(),
  evaluations: jsonb("evaluations").$type<Record<string, number>>(),
  sessionScore: integer("session_score"),
  description: text("description"),
  toysUsed: jsonb("toys_used").$type<string[]>(),
  roomsUsed: jsonb("rooms_used").$type<string[]>(),
  toolsUsed: jsonb("tools_used").$type<string[]>(),
  childResponse: text("child_response"),
  obstacles: text("obstacles"),
  recommendations: text("recommendations"),
  internalNotes: text("internal_notes"),
  reviewLog: jsonb("review_log").$type<Array<{
    status: string;
    note?: string;
    actorRole?: string;
    createdAt: string;
  }>>(),
  // Periodic report fields
  dateFrom: date("date_from"),
  dateTo: date("date_to"),
  progressPoints: jsonb("progress_points").$type<string[]>(),
  improvementPoints: jsonb("improvement_points").$type<string[]>(),
  summary: text("summary"),
  parentNotes: text("parent_notes"),
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Reschedule Requests ────────────────────────────────────────────

export const rescheduleRequests = pgTable("reschedule_requests", {
  id: text("id").primaryKey(),
  parentId: text("parent_id")
    .notNull()
    .references(() => parents.id),
  childId: text("child_id")
    .notNull()
    .references(() => children.id),
  sessionId: text("session_id")
    .notNull()
    .references(() => therapySessions.id),
  reason: text("reason"),
  details: text("details"),
  proposedSlots: jsonb("proposed_slots").$type<
    Array<{ date: string; time: string; status?: string; reason?: string; kind?: string }>
  >(),
  status: text("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  reviewedBy: text("reviewed_by").references(() => user.id),
  reviewedByRole: text("reviewed_by_role"),
  reviewedByName: text("reviewed_by_name"),
  newDate: date("new_date"),
  newStartTime: varchar("new_start_time", { length: 5 }),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Session Ratings ────────────────────────────────────────────────

export const sessionRatings = pgTable("session_ratings", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => therapySessions.id)
    .unique(),
  childId: text("child_id")
    .notNull()
    .references(() => children.id),
  parentId: text("parent_id")
    .notNull()
    .references(() => parents.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Notifications ──────────────────────────────────────────────────

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  type: varchar("type", { length: 50 }),
  icon: varchar("icon", { length: 50 }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  targetRole: text("target_role").notNull(), // admin | parent | therapist
  targetUserId: text("target_user_id"),
  relatedId: text("related_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notificationReads = pgTable(
  "notification_reads",
  {
    notificationId: text("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    readAt: timestamp("read_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.notificationId, t.userId] })]
);

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").references(() => user.id),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  summary: text("summary").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Announcements ──────────────────────────────────────────────────

export const migrationBatches = pgTable("migration_batches", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("dry_run"),
  sourceType: text("source_type").notNull().default("excel_csv"),
  fileName: text("file_name"),
  createdBy: text("created_by").references(() => user.id),
  summary: jsonb("summary").$type<Record<string, unknown>>(),
  appliedAt: timestamp("applied_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const migrationRecords = pgTable("migration_records", {
  id: text("id").primaryKey(),
  batchId: text("batch_id")
    .notNull()
    .references(() => migrationBatches.id),
  status: text("status").notNull().default("ready"),
  rowNumber: integer("row_number").notNull(),
  childId: text("child_id").references(() => children.id),
  therapyPeriodId: text("therapy_period_id").references(() => therapyPeriods.id),
  confidence: integer("confidence").notNull().default(0),
  errors: jsonb("errors").$type<string[]>(),
  warnings: jsonb("warnings").$type<string[]>(),
  sourceSnapshot: jsonb("source_snapshot").$type<Record<string, unknown>>(),
  normalizedData: jsonb("normalized_data").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const historicalSessionSummaries = pgTable("historical_session_summaries", {
  id: text("id").primaryKey(),
  migrationBatchId: text("migration_batch_id").references(() => migrationBatches.id),
  childId: text("child_id")
    .notNull()
    .references(() => children.id),
  therapyPeriodId: text("therapy_period_id")
    .notNull()
    .references(() => therapyPeriods.id),
  completedCount: integer("completed_count").notNull().default(0),
  firstKnownDate: date("first_known_date"),
  lastKnownDate: date("last_known_date"),
  sourceNote: text("source_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const announcements = pgTable("announcements", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content"),
  category: text("category").notNull().default("general"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const announcementTargetRoles = pgTable(
  "announcement_target_roles",
  {
    announcementId: text("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // admin | parent | therapist
  },
  (t) => [primaryKey({ columns: [t.announcementId, t.role] })]
);

// ── Clinic Settings ────────────────────────────────────────────────

export const clinicSettings = pgTable("clinic_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ══════════════════════════════════════════════════════════════════
// Relations (for Drizzle relational queries)
// ══════════════════════════════════════════════════════════════════

export const parentsRelations = relations(parents, ({ one, many }) => ({
  user: one(user, { fields: [parents.userId], references: [user.id] }),
  children: many(children),
}));

export const therapistsRelations = relations(therapists, ({ one, many }) => ({
  user: one(user, { fields: [therapists.userId], references: [user.id] }),
  sessions: many(therapySessions),
  reports: many(reports),
}));

export const childrenRelations = relations(children, ({ one, many }) => ({
  parent: one(parents, {
    fields: [children.parentId],
    references: [parents.id],
  }),
  therapyPrograms: many(therapyPrograms),
  therapyPeriods: many(therapyPeriods),
  sessions: many(therapySessions),
  reports: many(reports),
}));

export const programsRelations = relations(programs, ({ many }) => ({
  therapyPrograms: many(therapyPrograms),
  therapyPeriods: many(therapyPeriods),
}));

export const therapyProgramsRelations = relations(therapyPrograms, ({ one }) => ({
  child: one(children, {
    fields: [therapyPrograms.childId],
    references: [children.id],
  }),
  program: one(programs, {
    fields: [therapyPrograms.programId],
    references: [programs.id],
  }),
}));

export const therapyPeriodsRelations = relations(therapyPeriods, ({ one, many }) => ({
  child: one(children, {
    fields: [therapyPeriods.childId],
    references: [children.id],
  }),
  therapyProgram: one(therapyPrograms, {
    fields: [therapyPeriods.therapyProgramId],
    references: [therapyPrograms.id],
  }),
  program: one(programs, {
    fields: [therapyPeriods.programId],
    references: [programs.id],
  }),
  sessions: many(therapySessions),
  reports: many(reports),
  historicalSummaries: many(historicalSessionSummaries),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  sessions: many(therapySessions),
}));

export const therapySessionsRelations = relations(
  therapySessions,
  ({ one }) => ({
    therapist: one(therapists, {
      fields: [therapySessions.therapistId],
      references: [therapists.id],
    }),
    child: one(children, {
      fields: [therapySessions.childId],
      references: [children.id],
    }),
    room: one(rooms, {
      fields: [therapySessions.roomId],
      references: [rooms.id],
    }),
    therapyPeriod: one(therapyPeriods, {
      fields: [therapySessions.therapyPeriodId],
      references: [therapyPeriods.id],
    }),
  })
);

export const reportsRelations = relations(reports, ({ one }) => ({
  child: one(children, {
    fields: [reports.childId],
    references: [children.id],
  }),
  therapist: one(therapists, {
    fields: [reports.therapistId],
    references: [therapists.id],
  }),
  session: one(therapySessions, {
    fields: [reports.sessionId],
    references: [therapySessions.id],
  }),
  therapyPeriod: one(therapyPeriods, {
    fields: [reports.therapyPeriodId],
    references: [therapyPeriods.id],
  }),
}));

export const migrationBatchesRelations = relations(migrationBatches, ({ one, many }) => ({
  creator: one(user, {
    fields: [migrationBatches.createdBy],
    references: [user.id],
  }),
  records: many(migrationRecords),
  historicalSummaries: many(historicalSessionSummaries),
}));

export const migrationRecordsRelations = relations(migrationRecords, ({ one }) => ({
  batch: one(migrationBatches, {
    fields: [migrationRecords.batchId],
    references: [migrationBatches.id],
  }),
  child: one(children, {
    fields: [migrationRecords.childId],
    references: [children.id],
  }),
  therapyPeriod: one(therapyPeriods, {
    fields: [migrationRecords.therapyPeriodId],
    references: [therapyPeriods.id],
  }),
}));

export const historicalSessionSummariesRelations = relations(historicalSessionSummaries, ({ one }) => ({
  batch: one(migrationBatches, {
    fields: [historicalSessionSummaries.migrationBatchId],
    references: [migrationBatches.id],
  }),
  child: one(children, {
    fields: [historicalSessionSummaries.childId],
    references: [children.id],
  }),
  therapyPeriod: one(therapyPeriods, {
    fields: [historicalSessionSummaries.therapyPeriodId],
    references: [therapyPeriods.id],
  }),
}));

export const rescheduleRequestsRelations = relations(
  rescheduleRequests,
  ({ one }) => ({
    parent: one(parents, {
      fields: [rescheduleRequests.parentId],
      references: [parents.id],
    }),
    child: one(children, {
      fields: [rescheduleRequests.childId],
      references: [children.id],
    }),
    session: one(therapySessions, {
      fields: [rescheduleRequests.sessionId],
      references: [therapySessions.id],
    }),
  })
);
