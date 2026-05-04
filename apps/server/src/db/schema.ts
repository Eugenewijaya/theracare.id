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
  status: text("status").notNull().default("upcoming"), // upcoming | active | done | cancelled
  notes: text("notes"),
  cancelReason: text("cancel_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Reports ────────────────────────────────────────────────────────

export const reports = pgTable("reports", {
  id: text("id").primaryKey(), // REP-0001
  type: text("type").notNull(), // harian | periodik
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
  aspects: jsonb("aspects").$type<string[]>(),
  evaluations: jsonb("evaluations").$type<Record<string, number>>(),
  sessionScore: integer("session_score"),
  description: text("description"),
  childResponse: text("child_response"),
  obstacles: text("obstacles"),
  recommendations: text("recommendations"),
  internalNotes: text("internal_notes"),
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
    Array<{ date: string; time: string }>
  >(),
  status: text("status").notNull().default("pending"),
  reviewNote: text("review_note"),
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

// ── Announcements ──────────────────────────────────────────────────

export const announcements = pgTable("announcements", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content"),
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
  sessions: many(therapySessions),
  reports: many(reports),
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
