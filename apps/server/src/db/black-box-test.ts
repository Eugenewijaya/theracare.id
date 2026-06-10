import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type Actor = {
  name: string;
  token?: string;
  cookie?: string;
};

type ApiResult = {
  status: number;
  data: any;
  durationMs: number;
  setCookie?: string;
};

type TestResult = {
  id: string;
  name: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  detail?: string;
};

const BASE_URL = (process.env.BLACK_BOX_BASE_URL || "http://127.0.0.1:3100/api").replace(/\/+$/, "");
const ORIGIN = process.env.BLACK_BOX_ORIGIN || "http://127.0.0.1:4173";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "bbt.admin@theracare.test";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "BBT-Admin-2026!";
const RESET_PASSWORD = process.env.PORTAL_RESET_PASSWORD || "BBT-Reset-2026!";
const results: TestResult[] = [];

const admin: Actor = { name: "admin" };
const parent: Actor = { name: "parent" };
const otherParent: Actor = { name: "other-parent" };
const therapist: Actor = { name: "therapist" };
const substituteTherapist: Actor = { name: "substitute-therapist" };

const state: Record<string, any> = {};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string | Date, days: number) {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T12:00:00+07:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function nextWeekday(day: number, minimumDays = 10) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + minimumDays);
  while (date.getDay() !== day) date.setDate(date.getDate() + 1);
  return dateKey(date);
}

function nextWorkingDay(value: string, amount = 1) {
  let result = value;
  for (let index = 0; index < amount; index += 1) {
    result = addDays(result, 1);
    const day = new Date(`${result}T12:00:00+07:00`).getDay();
    if (day === 0) result = addDays(result, 1);
  }
  return result;
}

function nextDateWithWeekday(value: string, weekday: number, minimumDays = 1) {
  let result = addDays(value, minimumDays);
  while (new Date(`${result}T12:00:00+07:00`).getDay() !== weekday) {
    result = addDays(result, 1);
  }
  return result;
}

function unwrap(result: ApiResult) {
  return result.data?.data ?? result.data;
}

function errorText(result: ApiResult) {
  return String(result.data?.error || result.data?.message || result.data?.raw || `HTTP ${result.status}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectStatus(result: ApiResult, expected: number | number[]) {
  const statuses = Array.isArray(expected) ? expected : [expected];
  assert(
    statuses.includes(result.status),
    `expected HTTP ${statuses.join("/")}, received ${result.status}: ${errorText(result)}`,
  );
}

async function api(method: string, route: string, body?: unknown, actor?: Actor): Promise<ApiResult> {
  const startedAt = Date.now();
  const headers: Record<string, string> = {
    Accept: "application/json",
    Origin: ORIGIN,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (actor?.token) headers["x-theracare-session-token"] = actor.token;
  if (actor?.cookie) headers.Cookie = actor.cookie;
  const response = await fetch(`${BASE_URL}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  const setCookie = response.headers.get("set-cookie") || undefined;
  return { status: response.status, data, durationMs: Date.now() - startedAt, setCookie };
}

async function test(id: string, name: string, callback: () => Promise<void>) {
  const startedAt = Date.now();
  try {
    await callback();
    results.push({ id, name, status: "passed", durationMs: Date.now() - startedAt });
    console.log(`PASS ${id} ${name}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ id, name, status: "failed", durationMs: Date.now() - startedAt, detail });
    console.error(`FAIL ${id} ${name}: ${detail}`);
  }
}

async function step<T>(label: string, callback: () => Promise<T>) {
  try {
    return await callback();
  } catch (error) {
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function workingSchedule() {
  return {
    Senin: { start: "08:00", end: "18:00" },
    Selasa: { start: "08:00", end: "18:00" },
    Rabu: { start: "08:00", end: "18:00" },
    Kamis: { start: "08:00", end: "18:00" },
    Jumat: { start: "08:00", end: "18:00" },
    Sabtu: { start: "08:00", end: "16:00" },
  };
}

async function loginAdmin() {
  const result = await api("POST", "/auth/sign-in/email", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  expectStatus(result, 200);
  const payload = unwrap(result);
  admin.token = payload?.token || result.data?.token;
  admin.cookie = result.setCookie
    ?.split(",")
    .map((value) => value.trim().split(";")[0])
    .filter(Boolean)
    .join("; ");
  assert(admin.token, "admin login did not return a session token");
  assert(admin.cookie, "admin login did not return a session cookie");
  assert((payload?.user || result.data?.user)?.role === "admin", "admin role was not returned");
}

async function loginPortal(
  actor: Actor,
  route: "/parents/portal-login" | "/therapists/portal-login",
  credentials: Record<string, string>,
) {
  const result = await api("POST", route, credentials);
  expectStatus(result, 200);
  const payload = unwrap(result);
  actor.token = payload?.token;
  assert(actor.token, `${actor.name} login did not return a session token`);
  return payload;
}

async function main() {
  const periodStart = nextWeekday(1, 14);
  const periodEnd = addDays(periodStart, 35);
  state.periodStart = periodStart;
  state.periodEnd = periodEnd;

  await test("AUTH-01", "health and database health", async () => {
    expectStatus(await api("GET", "/health"), 200);
    expectStatus(await api("GET", "/health/db"), 200);
  });

  await test("AUTH-02", "protected route rejects anonymous access", async () => {
    expectStatus(await api("GET", "/parents"), 401);
  });

  await test("AUTH-03", "admin login rejects wrong password and accepts correct password", async () => {
    expectStatus(await api("POST", "/auth/sign-in/email", {
      email: ADMIN_EMAIL,
      password: "wrong-password",
    }), [400, 401]);
    await loginAdmin();
    const session = await api("GET", "/auth/get-session", undefined, admin);
    expectStatus(session, 200);
    assert(session.data?.session?.userId === session.data?.user?.id, "session userId contract is missing");
  });

  await test("REG-01", "program CRUD", async () => {
    const create = await api("POST", "/admin/programs", {
      name: "Black Box Program",
      code: "BBT",
      target: "Regression coverage",
      duration: 60,
      goals: ["End-to-end verification"],
    }, admin);
    expectStatus(create, 201);
    const program = unwrap(create);
    state.testProgramId = program.id;
    expectStatus(await api("PATCH", `/admin/programs/${program.id}`, {
      target: "Updated regression coverage",
    }, admin), 200);
    const list = await api("GET", "/admin/programs", undefined, admin);
    expectStatus(list, 200);
    assert(unwrap(list).some((item: any) => item.id === program.id), "created program not present in list");
    expectStatus(await api("DELETE", `/admin/programs/${program.id}`, undefined, admin), 200);
  });

  await test("REG-02", "room CRUD", async () => {
    const create = await api("POST", "/admin/rooms", {
      name: "Ruang Black Box",
      type: "Testing",
      capacity: 1,
      status: "active",
    }, admin);
    expectStatus(create, 201);
    const room = unwrap(create);
    state.testRoomId = room.id;
    expectStatus(await api("PATCH", `/admin/rooms/${room.id}`, {
      capacity: 2,
    }, admin), 200);
    expectStatus(await api("DELETE", `/admin/rooms/${room.id}`, undefined, admin), 200);
  });

  await test("COM-03", "settings update and public settings", async () => {
    expectStatus(await api("PATCH", "/admin/settings", {
      operatingHoursWeekday: "08:00 - 18:00",
      operatingHoursWeekend: "08:00 - 16:00",
      clinicName: "TheraCare Black Box",
    }, admin), 200);
    const settings = await api("GET", "/admin/public-settings");
    expectStatus(settings, 200);
    assert(unwrap(settings)?.clinicName === "TheraCare Black Box", "public clinic name was not updated");
  });

  await test("REG-03", "register two therapists with schedules", async () => {
    const primaryCreate = await api("POST", "/therapists", {
      name: "Terapis Black Box Utama",
      email: "bbt.therapist.primary@theracare.test",
      phone: "081211110001",
      specialty: "Occupational Therapy",
      schedule: workingSchedule(),
      primaryRoom: "RM-001",
      maxClients: 12,
      tempPassword: "BBT-Therapist-1!",
    }, admin);
    expectStatus(primaryCreate, 201);
    const primary = unwrap(primaryCreate);
    state.therapist = primary;
    state.therapistId = primary.id || primary.therapist?.id;
    state.therapistPassword = primary.tempPassword;
    assert(state.therapistId && state.therapistPassword, "primary therapist credentials missing");

    const substituteCreate = await api("POST", "/therapists", {
      name: "Terapis Black Box Pengganti",
      email: "bbt.therapist.substitute@theracare.test",
      phone: "081211110002",
      specialty: "Speech Therapy",
      schedule: workingSchedule(),
      primaryRoom: "RM-002",
      maxClients: 12,
      tempPassword: "BBT-Therapist-2!",
    }, admin);
    expectStatus(substituteCreate, 201);
    const substitute = unwrap(substituteCreate);
    state.substituteTherapistId = substitute.id || substitute.therapist?.id;
    state.substituteTherapistPassword = substitute.tempPassword;
    assert(state.substituteTherapistId && state.substituteTherapistPassword, "substitute therapist credentials missing");
  });

  await test("AUTH-04", "therapist portal login and suspended account guard", async () => {
    await loginPortal(therapist, "/therapists/portal-login", {
      nit: state.therapistId,
      password: state.therapistPassword,
    });
    await loginPortal(substituteTherapist, "/therapists/portal-login", {
      nit: state.substituteTherapistId,
      password: state.substituteTherapistPassword,
    });
    expectStatus(await api("GET", "/therapists/me/profile", undefined, therapist), 200);

    expectStatus(await api("PATCH", `/therapists/${state.substituteTherapistId}/status`, {
      status: "suspended",
    }, admin), 200);
    expectStatus(await api("POST", "/therapists/portal-login", {
      nit: state.substituteTherapistId,
      password: state.substituteTherapistPassword,
    }), 401);
    expectStatus(await api("PATCH", `/therapists/${state.substituteTherapistId}/status`, {
      status: "active",
    }, admin), 200);
    await loginPortal(substituteTherapist, "/therapists/portal-login", {
      nit: state.substituteTherapistId,
      password: state.substituteTherapistPassword,
    });
  });

  await test("AUTH-10", "explicit portal token overrides a conflicting admin cookie", async () => {
    const conflictingSession = {
      name: "therapist-with-admin-cookie",
      token: therapist.token,
      cookie: admin.cookie,
    };
    const session = await api("GET", "/auth/get-session", undefined, conflictingSession);
    expectStatus(session, 200);
    assert(session.data?.user?.role === "therapist", "portal token did not override admin cookie");
    assert(session.data?.session?.userId === session.data?.user?.id, "portal session userId contract is missing");
    expectStatus(await api("GET", "/therapists/me/profile", undefined, conflictingSession), 200);
  });

  await test("REG-05", "register two parent accounts and reject duplicate identity", async () => {
    const first = await api("POST", "/parents", {
      name: "Orang Tua Black Box",
      email: "bbt.parent@theracare.test",
      phone: "081222220001",
      address: "Jakarta",
      tempPassword: "BBT-Parent-1!",
    }, admin);
    expectStatus(first, 201);
    state.parent = unwrap(first);
    state.parentId = state.parent.id || state.parent.parent?.id;
    state.parentPassword = state.parent.tempPassword;
    assert(state.parentId && state.parentPassword, "parent credentials missing");

    const second = await api("POST", "/parents", {
      name: "Orang Tua Black Box Lain",
      email: "bbt.parent.other@theracare.test",
      phone: "081222220002",
      address: "Bandung",
      tempPassword: "BBT-Parent-2!",
    }, admin);
    expectStatus(second, 201);
    state.otherParent = unwrap(second);
    state.otherParentId = state.otherParent.id || state.otherParent.parent?.id;
    state.otherParentPassword = state.otherParent.tempPassword;

    const duplicate = await api("POST", "/parents", {
      name: "Duplikat",
      email: "bbt.parent@theracare.test",
      phone: "081222220003",
    }, admin);
    expectStatus(duplicate, 409);
  });

  await test("AUTH-05", "parent login supports email and phone and blocks suspended account", async () => {
    await loginPortal(parent, "/parents/portal-login", {
      identifier: "bbt.parent@theracare.test",
      password: state.parentPassword,
    });
    await loginPortal(otherParent, "/parents/portal-login", {
      identifier: "081222220002",
      password: state.otherParentPassword,
    });
    expectStatus(await api("GET", "/parents/me/profile", undefined, parent), 200);

    expectStatus(await api("PATCH", `/parents/${state.otherParentId}/status`, {
      status: "suspended",
    }, admin), 200);
    expectStatus(await api("POST", "/parents/portal-login", {
      identifier: "081222220002",
      password: state.otherParentPassword,
    }), 401);
    expectStatus(await api("PATCH", `/parents/${state.otherParentId}/status`, {
      status: "active",
    }, admin), 200);
    await loginPortal(otherParent, "/parents/portal-login", {
      identifier: "081222220002",
      password: state.otherParentPassword,
    });
  });

  await test("REG-07", "register children for new and existing family flows", async () => {
    const first = await api("POST", "/children", {
      parentId: state.parentId,
      firstName: "Anak",
      lastName: "Black Box",
      dob: "2020-05-15",
      gender: "male",
      diagnosis: "Audit flow",
      therapyProgramsList: [{
        programId: "PRG-OT",
        type: "Occupational Therapy (OT)",
        totalSessions: 6,
        goal: "Motor planning",
        createInitialPeriod: false,
      }],
    }, admin);
    expectStatus(first, 201);
    state.child = unwrap(first);
    state.childId = state.child.id;

    const sibling = await api("POST", "/children", {
      parentId: state.parentId,
      firstName: "Saudara",
      lastName: "Black Box",
      dob: "2021-06-10",
      gender: "female",
      therapyProgramsList: [{
        programId: "PRG-ST",
        type: "Speech & Language Therapy (ST)",
        totalSessions: 4,
        goal: "Komunikasi",
        createInitialPeriod: false,
      }],
    }, admin);
    expectStatus(sibling, 201);
    state.siblingId = unwrap(sibling).id;

    const other = await api("POST", "/children", {
      parentId: state.otherParentId,
      firstName: "Anak",
      lastName: "Keluarga Lain",
      dob: "2019-01-20",
      gender: "female",
      therapyProgramsList: [{
        programId: "PRG-PT",
        type: "Physical Therapy (PT)",
        totalSessions: 4,
        goal: "Motorik kasar",
        createInitialPeriod: false,
      }],
    }, admin);
    expectStatus(other, 201);
    state.otherChildId = unwrap(other).id;

    const list = await api("GET", `/children/by-parent/${state.parentId}`, undefined, parent);
    expectStatus(list, 200);
    assert(unwrap(list).length === 2, "existing parent should have two children");
  });

  await test("AUTH-06", "role isolation rejects parent from admin actions", async () => {
    expectStatus(await api("GET", "/admin/stats", undefined, parent), 403);
    expectStatus(await api("POST", "/admin/rooms", { name: "Illegal room" }, parent), 403);
  });

  await test("AUTH-07", "ownership isolation rejects access to another family", async () => {
    expectStatus(await api("GET", `/children/${state.otherChildId}`, undefined, parent), 403);
    expectStatus(await api("GET", `/children/by-parent/${state.otherParentId}`, undefined, parent), 403);
  });

  await test("REG-09", "child profile edit and parent photo update", async () => {
    expectStatus(await api("PATCH", `/children/${state.childId}`, {
      diagnosis: "Audit flow updated",
    }, admin), 200);
    const photo = await api("PATCH", `/children/${state.childId}/photo`, {
      photoUrl: "https://example.test/child-photo.png",
    }, parent);
    expectStatus(photo, 200);
    assert(unwrap(photo).photoUrl === "https://example.test/child-photo.png", "child photo was not returned");
  });

  await test("AUTH-08", "parent password reset invalidates old password", async () => {
    const reset = await api("POST", `/parents/${state.parentId}/reset-password`, {
      tempPassword: RESET_PASSWORD,
    }, admin);
    expectStatus(reset, 200);
    expectStatus(await api("POST", "/parents/portal-login", {
      identifier: "bbt.parent@theracare.test",
      password: state.parentPassword,
    }), 401);
    state.parentPassword = RESET_PASSWORD;
    await loginPortal(parent, "/parents/portal-login", {
      identifier: "bbt.parent@theracare.test",
      password: state.parentPassword,
    });
  });

  await test("REG-04", "therapist reset and self-profile field restrictions", async () => {
    const reset = await api("POST", `/therapists/${state.substituteTherapistId}/reset-password`, {
      tempPassword: "BBT-Therapist-Reset!",
    }, admin);
    expectStatus(reset, 200);
    expectStatus(await api("POST", "/therapists/portal-login", {
      nit: state.substituteTherapistId,
      password: state.substituteTherapistPassword,
    }), 401);
    state.substituteTherapistPassword = "BBT-Therapist-Reset!";
    await loginPortal(substituteTherapist, "/therapists/portal-login", {
      nit: state.substituteTherapistId,
      password: state.substituteTherapistPassword,
    });
    expectStatus(await api("PATCH", `/therapists/${state.substituteTherapistId}`, {
      schedule: workingSchedule(),
    }, substituteTherapist), 403);
    const profile = await api("PATCH", `/therapists/${state.substituteTherapistId}`, {
      bio: "Profil diperbarui melalui black-box.",
    }, substituteTherapist);
    expectStatus(profile, 200);
    assert(unwrap(profile).bio === "Profil diperbarui melalui black-box.", "allowed therapist profile update was not stored");
  });

  await test("SCH-01", "create therapy period with generated sessions", async () => {
    const create = await api("POST", "/therapy-periods", {
      childId: state.childId,
      programId: "PRG-OT",
      type: "Occupational Therapy (OT)",
      name: "Periode Black Box 1",
      startDate: periodStart,
      endDate: periodEnd,
      totalSessions: 6,
      therapistId: state.therapistId,
      scheduleRules: [
        { day: "Monday", startTime: "09:00", duration: "60 mins", therapistId: state.therapistId, roomId: "RM-001" },
        { day: "Wednesday", startTime: "09:00", duration: "60 mins", therapistId: state.therapistId, roomId: "RM-001" },
      ],
      goals: ["Motor planning"],
      generateSessions: true,
    }, admin);
    expectStatus(create, 201);
    state.period = unwrap(create);
    state.periodId = state.period.id;
    assert(state.periodId, "period id missing");
    assert(state.period.sessionGeneration?.created === 6, "period did not generate six sessions");

    const allSessions = await api("GET", `/sessions?from=${periodStart}&to=${periodEnd}`, undefined, admin);
    expectStatus(allSessions, 200);
    state.sessions = unwrap(allSessions).filter((item: any) => item.therapyPeriodId === state.periodId);
    assert(state.sessions.length === 6, `expected six period sessions, received ${state.sessions.length}`);
  });

  await test("SCH-03", "schedule is visible to all related actors", async () => {
    expectStatus(await api("GET", `/therapy-periods/child/${state.childId}`, undefined, parent), 200);
    const therapistSchedule = await api("GET", `/sessions/therapist/${state.therapistId}`, undefined, therapist);
    expectStatus(therapistSchedule, 200);
    assert(unwrap(therapistSchedule).some((item: any) => item.therapyPeriodId === state.periodId), "therapist cannot see period session");
    const parentSchedule = await api("GET", `/sessions/child/${state.childId}/upcoming`, undefined, parent);
    expectStatus(parentSchedule, 200);
    assert(unwrap(parentSchedule).length >= 6, "parent cannot see generated sessions");
  });

  await test("SCH-04", "child overlap is rejected", async () => {
    const original = state.sessions[0];
    const conflict = await api("POST", "/sessions", {
      therapistId: state.substituteTherapistId,
      childId: state.childId,
      roomId: "RM-002",
      date: original.date,
      startTime: original.startTime,
      duration: original.duration,
      focus: "Child conflict",
    }, admin);
    expectStatus(conflict, 409);
  });

  await test("SCH-05", "therapist overlap is rejected", async () => {
    const original = state.sessions[0];
    const conflict = await api("POST", "/sessions", {
      therapistId: state.therapistId,
      childId: state.otherChildId,
      roomId: "RM-002",
      date: original.date,
      startTime: original.startTime,
      duration: original.duration,
      focus: "Therapist conflict",
    }, admin);
    expectStatus(conflict, 409);
  });

  await test("SCH-06", "room overlap is rejected", async () => {
    const original = state.sessions[0];
    const conflict = await api("POST", "/sessions", {
      therapistId: state.substituteTherapistId,
      childId: state.otherChildId,
      roomId: "RM-001",
      date: original.date,
      startTime: original.startTime,
      duration: original.duration,
      focus: "Room conflict",
    }, admin);
    expectStatus(conflict, 409);
  });

  await test("SCH-07", "outside therapist working hours is rejected", async () => {
    const conflict = await api("POST", "/sessions", {
      therapistId: state.therapistId,
      childId: state.otherChildId,
      roomId: "RM-002",
      date: nextWorkingDay(periodStart, 1),
      startTime: "19:00",
      duration: "60 mins",
      focus: "Outside hours",
    }, admin);
    expectStatus(conflict, 409);
  });

  await test("SCH-11", "one-time visit is stored without child record", async () => {
    const visit = await api("POST", "/sessions/one-time-visits", {
      visitorName: "Calon Client Black Box",
      therapistId: state.substituteTherapistId,
      date: nextWorkingDay(periodStart, 2),
      startTime: "15:00",
      duration: "60 mins",
      focus: "Observasi",
    }, admin);
    expectStatus(visit, 201);
    const payload = unwrap(visit);
    assert(payload.isOneTime === true && !payload.childId, "one-time visit created a child relationship");
  });

  await test("OPS-01", "admin confirms attendance", async () => {
    state.completedSession = state.sessions[0];
    const result = await api("PATCH", `/sessions/${state.completedSession.id}/status`, {
      status: "confirmed",
    }, admin);
    expectStatus(result, 200);
    assert(unwrap(result).status === "confirmed", "session was not confirmed");
  });

  await test("OPS-03", "therapist must start before completing own session", async () => {
    expectStatus(await api("PATCH", `/sessions/${state.completedSession.id}/status`, {
      status: "done",
    }, therapist), 409);
    expectStatus(await api("PATCH", `/sessions/${state.completedSession.id}/status`, {
      status: "active",
    }, therapist), 200);
    expectStatus(await api("PATCH", `/sessions/${state.completedSession.id}/notes`, {
      notes: "Catatan black-box sesi aktif.",
    }, therapist), 200);
    const done = await api("PATCH", `/sessions/${state.completedSession.id}/status`, {
      status: "done",
    }, therapist);
    expectStatus(done, 200);
    assert(unwrap(done).status === "done", "session was not completed");
  });

  await test("REP-01", "therapist can save daily report draft", async () => {
    const draft = await api("POST", "/reports", {
      type: "harian",
      childId: state.childId,
      sessionId: state.completedSession.id,
      therapyPeriodId: state.periodId,
      status: "draft",
      date: state.completedSession.date,
      description: "Draft laporan black-box.",
      childResponse: "Kooperatif",
      recommendations: "Latihan di rumah",
    }, therapist);
    expectStatus(draft, 201);
    state.report = unwrap(draft);
    state.reportId = state.report.id;
    assert(state.report.status === "draft", "report draft status mismatch");
  });

  await test("REP-02", "therapist publishes completed-session report to parent", async () => {
    const submit = await api("POST", "/reports", {
      id: state.reportId,
      type: "harian",
      childId: state.childId,
      sessionId: state.completedSession.id,
      therapyPeriodId: state.periodId,
      status: "ready_for_parent",
      date: state.completedSession.date,
      description: "Laporan lengkap black-box.",
      childResponse: "Kooperatif dan fokus",
      recommendations: "Lanjutkan latihan motorik",
    }, therapist);
    expectStatus(submit, 201);
    state.report = unwrap(submit);
    assert(state.report.status === "ready_for_parent", "submitted report is not parent-visible");
    const parentReports = await api("GET", `/reports/child/${state.childId}`, undefined, parent);
    expectStatus(parentReports, 200);
    assert(unwrap(parentReports).some((item: any) => item.id === state.reportId), "parent cannot see submitted report");
  });

  await test("REP-03", "admin requests revision and therapist resubmits", async () => {
    const revision = await api("PATCH", `/reports/${state.reportId}/status`, {
      status: "needs_revision",
      reviewNote: "Mohon lengkapi respons anak secara lebih rinci.",
    }, admin);
    expectStatus(revision, 200);
    assert(unwrap(revision).status === "needs_revision", "report revision status mismatch");
    const resubmit = await api("POST", "/reports", {
      id: state.reportId,
      type: "harian",
      childId: state.childId,
      sessionId: state.completedSession.id,
      therapyPeriodId: state.periodId,
      status: "ready_for_parent",
      date: state.completedSession.date,
      description: "Laporan revisi lengkap black-box.",
      childResponse: "Kooperatif, fokus, dan mengikuti tiga instruksi.",
      recommendations: "Lanjutkan latihan motorik",
    }, therapist);
    expectStatus(resubmit, 201);
    assert(unwrap(resubmit).status === "ready_for_parent", "revised report did not return to parent-visible status");
  });

  await test("REP-07", "parent rates only completed owned session", async () => {
    const rating = await api("POST", `/sessions/${state.completedSession.id}/rating`, {
      rating: 5,
      comment: "Pelayanan baik.",
    }, parent);
    expectStatus(rating, 201);
    expectStatus(await api("POST", `/sessions/${state.completedSession.id}/rating`, {
      rating: 4,
      comment: "Rating diperbarui.",
    }, otherParent), 403);
  });

  await test("RSC-01", "reschedule preview enforces half-hour slots and returns promptly", async () => {
    state.rescheduleSession = state.sessions[1];
    const invalid = await api("POST", "/reschedule/preview-slots", {
      childId: state.childId,
      sessionId: state.rescheduleSession.id,
      proposedSlots: [{ date: nextWorkingDay(state.rescheduleSession.date, 1), time: "10:15" }],
    }, parent);
    expectStatus(invalid, 400);

    const candidateDate = nextWorkingDay(state.rescheduleSession.date, 1);
    const preview = await api("POST", "/reschedule/preview-slots", {
      childId: state.childId,
      sessionId: state.rescheduleSession.id,
      proposedSlots: [
        { date: candidateDate, time: "10:00" },
        { date: candidateDate, time: "10:30" },
      ],
    }, parent);
    expectStatus(preview, 200);
    assert(preview.durationMs < 5000, `slot preview took too long (${preview.durationMs}ms)`);
    const slots = unwrap(preview);
    assert(slots.length === 2, "slot preview did not return both preferences");
    assert(slots.every((slot: any) => [0, 30].includes(Number(slot.time.slice(3)))), "slot preview returned non-half-hour time");
    const available = slots.find((slot: any) => slot.status === "available");
    assert(available, `no preview slot available: ${JSON.stringify(slots)}`);
    state.rescheduleSlot = available;
  });

  await test("RSC-03", "parent creates one open reschedule request", async () => {
    const create = await api("POST", "/reschedule", {
      parentId: state.parentId,
      childId: state.childId,
      sessionId: state.rescheduleSession.id,
      reason: "Jadwal keluarga",
      details: "Memerlukan perubahan jadwal untuk pengujian.",
      proposedSlots: [state.rescheduleSlot],
    }, parent);
    expectStatus(create, 201);
    state.reschedule = unwrap(create);
    state.rescheduleId = state.reschedule.id;
    const duplicate = await api("POST", "/reschedule", {
      parentId: state.parentId,
      childId: state.childId,
      sessionId: state.rescheduleSession.id,
      reason: "Duplikat",
      proposedSlots: [state.rescheduleSlot],
    }, parent);
    expectStatus(duplicate, 409);
  });

  await test("RSC-04", "parent cannot reschedule another family's session", async () => {
    const attempt = await api("POST", "/reschedule/preview-slots", {
      childId: state.otherChildId,
      sessionId: state.rescheduleSession.id,
      proposedSlots: [state.rescheduleSlot],
    }, otherParent);
    expectStatus(attempt, 403);
  });

  await test("RSC-05", "primary therapist approves reschedule exactly once", async () => {
    const approve = await api("PATCH", `/reschedule/${state.rescheduleId}/therapist-response`, {
      decision: "approve",
      reviewNote: "Slot tersedia dan disetujui.",
      newDate: state.rescheduleSlot.date,
      newStartTime: state.rescheduleSlot.time,
    }, therapist);
    expectStatus(approve, 200);
    assert(unwrap(approve).status === "approved", "reschedule was not approved");
    const session = await api("GET", `/sessions/${state.rescheduleSession.id}`, undefined, parent);
    expectStatus(session, 200);
    assert(unwrap(session).date === state.rescheduleSlot.date, "session date did not move");

    const repeat = await api("PATCH", `/reschedule/${state.rescheduleId}/therapist-response`, {
      decision: "approve",
      newDate: state.rescheduleSlot.date,
      newStartTime: state.rescheduleSlot.time,
    }, therapist);
    expectStatus(repeat, 200);
    assert(unwrap(repeat).status === "approved", "repeat response corrupted request status");
  });

  await test("SUB-01", "admin creates substitute request and therapist responds", async () => {
    const target = state.sessions[2];
    const create = await api("POST", "/substitute-requests", {
      sessionId: target.id,
      substituteTherapistId: state.substituteTherapistId,
      leaveType: "izin",
      note: "Konfirmasi substitusi black-box.",
    }, admin);
    expectStatus(create, 201);
    const request = unwrap(create);
    state.substituteRequestId = request.id;
    const response = await api("PATCH", `/substitute-requests/${request.id}/therapist-response`, {
      decision: "approve",
      responseNote: "Disetujui untuk sesi ini.",
    }, therapist);
    expectStatus(response, 200);
  });

  await test("MTG-01", "therapist creates meeting and parent confirms after admin review", async () => {
    const meetingDate = nextWorkingDay(periodEnd, 3);
    const create = await api("POST", "/meetings", {
      childId: state.childId,
      date: meetingDate,
      time: "13:00",
      topic: "Evaluasi Black Box",
      notes: "Pertemuan lintas aktor.",
    }, therapist);
    expectStatus(create, 201);
    const meeting = unwrap(create);
    state.meetingId = meeting.id;
    expectStatus(await api("PATCH", `/meetings/${meeting.id}/admin-review`, {
      status: "approved_by_admin",
      parentContactConfirmed: true,
      reviewNote: "Orang tua sudah dihubungi.",
    }, admin), 200);
    const response = await api("PATCH", `/meetings/${meeting.id}/parent-response`, {
      status: "parent_confirmed",
      note: "Bisa hadir.",
    }, parent);
    expectStatus(response, 200);
  });

  await test("TLV-01", "therapist leave request and admin decision", async () => {
    const leaveStart = nextWorkingDay(periodEnd, 7);
    const create = await api("POST", "/leave-requests", {
      type: "cuti",
      startDate: leaveStart,
      endDate: nextWorkingDay(leaveStart, 1),
      reason: "Keperluan keluarga untuk black-box.",
    }, therapist);
    expectStatus(create, 201);
    const leave = unwrap(create);
    state.leaveRequestId = leave.id;
    const approve = await api("PATCH", `/leave-requests/${leave.id}`, {
      status: "approved",
      reviewNote: "Disetujui admin.",
    }, admin);
    expectStatus(approve, 200);
    assert(unwrap(approve).status === "approved", "therapist leave was not approved");
  });

  await test("CLV-01", "admin creates and confirms child leave with session movements", async () => {
    const eligible = state.sessions
      .filter((item: any) => ![state.completedSession.id, state.rescheduleSession.id].includes(item.id))
      .slice(0, 2)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
    assert(eligible.length === 2, "not enough untouched sessions for child leave");
    state.childLeaveOriginalDates = eligible.map((item: any) => item.date);
    const create = await api("POST", "/child-leaves", {
      childId: state.childId,
      therapyPeriodId: state.periodId,
      startDate: eligible[0].date,
      endDate: eligible[1].date,
      reason: "Cuti keluarga dua sesi.",
    }, admin);
    expectStatus(create, 201);
    const request = unwrap(create);
    state.childLeaveId = request.id;
    assert(request.impacts.length >= 2, "child leave did not detect impacted sessions");

    const confirm = await api("POST", `/child-leaves/${request.id}/confirm`, {
      communicationChannel: "whatsapp",
      communicationNote: "Dikonfirmasi orang tua melalui WhatsApp.",
    }, admin);
    expectStatus(confirm, 200);
    const confirmed = unwrap(confirm);
    assert(confirmed.status === "confirmed", "child leave was not confirmed");
    assert(confirmed.impacts.filter((item: any) => item.status === "moved").length >= 2, "impacted sessions were not moved");
  });

  await test("CLV-03", "admin shortens child leave and restores released session", async () => {
    const revise = await api("PATCH", `/child-leaves/${state.childLeaveId}/revise`, {
      startDate: state.childLeaveOriginalDates[0],
      endDate: state.childLeaveOriginalDates[0],
      strategy: "restore_original",
      communicationChannel: "phone",
      communicationNote: "Orang tua mengubah cuti menjadi satu sesi.",
    }, admin);
    expectStatus(revise, 200);
    const request = unwrap(revise);
    assert(request.status === "revised", "child leave was not revised");
    assert(request.impacts.some((item: any) => item.status === "restored"), "released session was not restored");
  });

  await test("CLV-04", "admin cancels child leave and restores remaining schedule", async () => {
    const cancel = await api("POST", `/child-leaves/${state.childLeaveId}/cancel`, {
      communicationChannel: "in_person",
      communicationNote: "Orang tua membatalkan cuti saat tatap muka.",
    }, admin);
    expectStatus(cancel, 200);
    const request = unwrap(cancel);
    assert(request.status === "cancelled", "child leave was not cancelled");
  });

  await test("HLD-00", "Indonesian public holidays can be fetched and applied once", async () => {
    const holidayResult = await api("GET", "/admin/center-closures/indonesia-holidays?year=2026", undefined, admin);
    expectStatus(holidayResult, 200);
    const holidays = unwrap(holidayResult);
    assert(Array.isArray(holidays) && holidays.length > 0, "Indonesian holiday provider returned no dates");
    const holiday = holidays[0];
    assert(/^\d{4}-\d{2}-\d{2}$/.test(holiday.date), "holiday date is not ISO formatted");

    const applied = await api("POST", "/admin/center-closures/apply-holidays", {
      year: 2026,
      holidays: [holiday],
      notify: false,
    }, admin);
    expectStatus(applied, 201);
    const appliedData = unwrap(applied);
    assert(appliedData.added === 1, "selected public holiday was not applied exactly once");
    const closure = appliedData.closures.find((item: any) => (
      item.type === "public_holiday" && item.startDate === holiday.date
    ));
    assert(closure?.id, "applied public holiday closure is missing");
    expectStatus(await api("DELETE", `/admin/center-closures/${closure.id}`, undefined, admin), 200);
  });

  await test("HLD-01", "manual center closure detects impacted session", async () => {
    const liveResponse = await api(
      "GET",
      `/sessions?from=${state.periodStart}&to=${addDays(state.periodEnd, 30)}`,
      undefined,
      admin,
    );
    expectStatus(liveResponse, 200);
    const target = unwrap(liveResponse).find((item: any) => (
      item.therapyPeriodId === state.periodId
      && ![state.completedSession.id, state.rescheduleSession.id].includes(item.id)
      && item.status === "upcoming"
    ));
    assert(target, "no untouched session available for closure test");
    state.closureSession = target;
    const create = await api("POST", "/admin/center-closures", {
      title: "Hari Libur Black Box",
      type: "manual_off",
      source: "manual",
      startDate: target.date,
      endDate: target.date,
      note: "Pengujian jadwal off.",
      isActive: true,
      notify: false,
    }, admin);
    expectStatus(create, 201);
    const closure = unwrap(create);
    state.closureId = closure.id;
    assert(closure.impacts.some((item: any) => item.sessionId === target.id), "closure did not list impacted session");
  });

  await test("HLD-03", "admin records parent contact and manually reschedules closure impact", async () => {
    expectStatus(await api("PATCH", `/admin/center-closures/${state.closureId}/impacts/${state.closureSession.id}/contact`, {
      channel: "whatsapp",
      note: "Orang tua menyetujui jadwal pengganti.",
    }, admin), 200);
    const replacementDate = nextWorkingDay(periodEnd, 8);
    const move = await api("POST", `/admin/center-closures/${state.closureId}/impacts/${state.closureSession.id}/reschedule`, {
      date: replacementDate,
      startTime: "11:30",
      note: "Pengganti hasil konfirmasi WhatsApp.",
    }, admin);
    expectStatus(move, 200);
    assert(unwrap(move).impact?.status === "rescheduled_manual", "closure impact was not manually rescheduled");
  });

  await test("HLD-05", "H-1 automation moves unconfirmed closure session after its original date", async () => {
    const today = dateKey(new Date());
    const dueDate = nextWorkingDay(today, 1);
    const sessionCreate = await api("POST", "/sessions", {
      therapistId: state.substituteTherapistId,
      childId: state.otherChildId,
      roomId: "RM-006",
      date: dueDate,
      startTime: "14:00",
      duration: "60 mins",
      focus: "Automatic closure test",
    }, admin);
    expectStatus(sessionCreate, 201);
    const dueSession = unwrap(sessionCreate);
    const closureCreate = await api("POST", "/admin/center-closures", {
      title: "H-1 Black Box",
      type: "temporary_closure",
      source: "manual",
      startDate: dueDate,
      endDate: dueDate,
      note: "Tidak ada konfirmasi sampai H-1.",
      isActive: true,
      notify: false,
    }, admin);
    expectStatus(closureCreate, 201);
    const closure = unwrap(closureCreate);
    assert(closure.impacts.some((item: any) => item.sessionId === dueSession.id), "automatic closure did not detect due session");
    const process = await api("POST", "/admin/center-closures/process-due", { limit: 10 }, admin);
    expectStatus(process, 200);
    assert(unwrap(process).rescheduled >= 1, "H-1 automation did not create a replacement");
    const refreshed = await api("GET", `/admin/center-closures`, undefined, admin);
    expectStatus(refreshed, 200);
    const saved = unwrap(refreshed).closures.find((item: any) => item.id === closure.id);
    const impact = saved?.impacts?.find((item: any) => item.sessionId === dueSession.id);
    assert(impact?.status === "rescheduled_auto", `unexpected automatic impact status: ${impact?.status}`);
    assert(impact.replacementDate > dueDate, "automatic replacement was not scheduled after the original date");
  });

  await test("HLD-06", "resolved closure cannot be deleted but can be disabled", async () => {
    expectStatus(await api("DELETE", `/admin/center-closures/${state.closureId}`, undefined, admin), 409);
    const update = await api("PATCH", `/admin/center-closures/${state.closureId}`, {
      isActive: false,
      notify: false,
    }, admin);
    expectStatus(update, 200);
    assert(unwrap(update).isActive === false, "closure was not disabled");
  });

  await test("COM-01", "announcement targets only selected role", async () => {
    const create = await api("POST", "/admin/announcements", {
      title: "Pengumuman Black Box Orang Tua",
      content: "Hanya untuk portal orang tua.",
      category: "general",
      targetRoles: ["parent"],
      isActive: true,
    }, admin);
    expectStatus(create, 201);
    const announcement = unwrap(create);
    state.announcementId = announcement.id;
    const parentList = await api("GET", "/admin/announcements/role/parent", undefined, parent);
    expectStatus(parentList, 200);
    assert(unwrap(parentList).some((item: any) => item.id === announcement.id), "parent-targeted announcement missing");
    const therapistList = await api("GET", "/admin/announcements/role/therapist", undefined, therapist);
    expectStatus(therapistList, 200);
    assert(!unwrap(therapistList).some((item: any) => item.id === announcement.id), "parent announcement leaked to therapist");
  });

  await test("COM-02", "notification unread, read, read-all, and admin delete", async () => {
    const create = await api("POST", "/notifications", {
      type: "general",
      icon: "science",
      title: "Notifikasi Black Box",
      message: "Pengujian status baca.",
      targetRole: "parent",
      targetUserId: state.parent.user?.id || state.parent.userId,
    }, admin);
    expectStatus(create, 201);
    const notification = unwrap(create);
    const unread = await api("GET", "/notifications/unread-count", undefined, parent);
    expectStatus(unread, 200);
    assert(Number(unwrap(unread).count) > 0, "parent unread count did not increase");
    expectStatus(await api("PATCH", `/notifications/${notification.id}/read`, undefined, parent), 200);
    expectStatus(await api("POST", "/notifications/read-all", {}, parent), 200);
    expectStatus(await api("DELETE", `/notifications/${notification.id}`, undefined, admin), 200);
  });

  await test("SEC-01", "audit log contains critical actions", async () => {
    const logs = await api("GET", "/audit-logs?limit=200", undefined, admin);
    expectStatus(logs, 200);
    const actions = new Set(unwrap(logs).map((item: any) => item.action));
    for (const action of ["parent.create", "therapist.create", "therapy_period.create", "reschedule.create", "child_leave.confirm"]) {
      assert(actions.has(action), `audit action missing: ${action}`);
    }
  });

  await test("AUTH-09", "authenticated location signal round trip", async () => {
    expectStatus(await api("POST", "/location/signal", {
      latitude: -6.2,
      longitude: 106.8,
      accuracy: 25,
      source: "black_box",
    }, therapist), 200);
    expectStatus(await api("GET", "/location/me", undefined, therapist), 200);
  });

  await test("COM-03B", "sync version changes after mutations", async () => {
    const version = await api("GET", "/sync/version", undefined, admin);
    expectStatus(version, 200);
    assert(String(unwrap(version)?.version || unwrap(version)?.revision || "0") !== "0", "system revision was not incremented");
  });

  await test("DB-01", "database guard fails safely when Neon API key is invalid", async () => {
    const usage = await api("GET", "/admin/database/usage", undefined, admin);
    expectStatus(usage, [200, 401, 502, 503]);
    if (usage.status !== 200) {
      const serialized = JSON.stringify(usage.data);
      assert(!serialized.includes("postgresql://"), "database guard leaked a connection string");
      assert(!serialized.toLowerCase().includes("bearer "), "database guard leaked an authorization token");
    }
  });

  await test("PER-01", "active incomplete period cannot be completed", async () => {
    const result = await api("POST", `/therapy-periods/${state.periodId}/complete`, {
      notes: "Should be rejected because sessions remain upcoming.",
    }, admin);
    expectStatus(result, 409);
  });

  await test("PER-03", "active period cannot be renewed", async () => {
    const result = await api("POST", `/therapy-periods/${state.periodId}/renew`, {
      startDate: nextDateWithWeekday(state.periodEnd, 1, 7),
      totalSessions: 1,
      generateSessions: false,
    }, admin);
    expectStatus(result, 400);
  });

  await test("PER-02", "fully completed period can be closed idempotently", async () => {
    const startDate = nextDateWithWeekday(state.periodEnd, 1, 14);
    const create = await api("POST", "/therapy-periods", {
      childId: state.siblingId,
      programId: "PRG-ST",
      type: "Speech & Language Therapy (ST)",
      name: "Periode Selesai Black Box",
      startDate,
      endDate: addDays(startDate, 3),
      totalSessions: 1,
      therapistId: state.therapistId,
      scheduleRules: [{
        day: "Monday",
        startTime: "13:00",
        duration: "60 mins",
        therapistId: state.therapistId,
        roomId: "RM-003",
      }],
      generateSessions: true,
    }, admin);
    expectStatus(create, 201);
    const period = unwrap(create);
    state.completedPeriodId = period.id;
    const sessions = await api("GET", `/sessions?from=${startDate}&to=${addDays(startDate, 3)}`, undefined, admin);
    expectStatus(sessions, 200);
    const session = unwrap(sessions).find((item: any) => item.therapyPeriodId === period.id);
    assert(session, "completed-period session was not generated");
    expectStatus(await api("PATCH", `/sessions/${session.id}/status`, { status: "confirmed" }, admin), 200);
    expectStatus(await api("PATCH", `/sessions/${session.id}/status`, { status: "active" }, therapist), 200);
    expectStatus(await api("PATCH", `/sessions/${session.id}/status`, { status: "done" }, therapist), 200);
    const complete = await api("POST", `/therapy-periods/${period.id}/complete`, {
      notes: "Seluruh sesi selesai.",
    }, admin);
    expectStatus(complete, 200);
    assert(unwrap(complete).status === "completed", "period was not completed");
    const repeat = await api("POST", `/therapy-periods/${period.id}/complete`, {}, admin);
    expectStatus(repeat, 200);
    assert(unwrap(repeat).status === "completed", "repeat completion changed final status");
  });

  await test("PER-04", "completed period renews once with the next sequence", async () => {
    const renewalStart = nextDateWithWeekday(state.periodEnd, 1, 28);
    const renew = await api("POST", `/therapy-periods/${state.completedPeriodId}/renew`, {
      name: "Periode Lanjutan Black Box",
      startDate: renewalStart,
      endDate: addDays(renewalStart, 7),
      totalSessions: 1,
      scheduleRules: [{
        day: "Monday",
        startTime: "13:00",
        duration: "60 mins",
        therapistId: state.therapistId,
        roomId: "RM-003",
      }],
      generateSessions: false,
    }, admin);
    expectStatus(renew, 201);
    const period = unwrap(renew);
    state.renewedPeriodId = period.id;
    assert(period.renewalOf === state.completedPeriodId, "renewal does not reference source period");
    assert(Number(period.periodNumber) === 2, `unexpected renewal sequence: ${period.periodNumber}`);
  });

  await test("PER-05", "period deletion requires parent and therapist approvals", async () => {
    const requestCreate = await api("POST", `/therapy-periods/${state.renewedPeriodId}/deletion-requests`, {
      reason: "Periode lanjutan dibuat untuk pengujian penghapusan.",
    }, admin);
    expectStatus(requestCreate, 201);
    const request = unwrap(requestCreate);
    expectStatus(await api("PATCH", `/therapy-periods/deletion-requests/${request.id}/respond`, {
      decision: "approved",
      note: "Orang tua menyetujui.",
    }, parent), 200);
    const therapistDecision = await api("PATCH", `/therapy-periods/deletion-requests/${request.id}/respond`, {
      decision: "approved",
      note: "Terapis menyetujui.",
    }, therapist);
    expectStatus(therapistDecision, 200);
    assert(unwrap(therapistDecision).status === "executed", "approved deletion was not executed");
    const period = await api("GET", `/therapy-periods/${state.renewedPeriodId}`, undefined, admin);
    expectStatus(period, 200);
    assert(unwrap(period).status === "cancelled", "deleted period was not marked cancelled");
    expectStatus(await api("DELETE", `/therapy-periods/${state.renewedPeriodId}`, undefined, admin), 200);
  });

  await test("MIG-01", "migration dry-run blocks incomplete rows", async () => {
    const dryRun = await api("POST", "/migration/batches/dry-run", {
      sourceType: "black_box",
      fileName: "invalid.csv",
      rows: [{ childName: "Data Tidak Lengkap" }],
    }, admin);
    expectStatus(dryRun, 201);
    const batch = unwrap(dryRun);
    assert(batch.summary.blockedRows === 1, "invalid migration row was not blocked");
    expectStatus(await api("POST", `/migration/batches/${batch.id}/apply`, {}, admin), 409);
  });

  await test("MIG-02", "valid migration batch applies exactly once", async () => {
    const migrationStart = nextDateWithWeekday(state.periodEnd, 2, 35);
    const dryRun = await api("POST", "/migration/batches/dry-run", {
      sourceType: "black_box",
      fileName: "valid.csv",
      rows: [{
        parentName: "Orang Tua Migrasi",
        parentPhone: "081233330001",
        parentEmail: "bbt.migration.parent@theracare.test",
        childName: "Anak Migrasi",
        childDob: "2018-08-08",
        childGender: "male",
        programId: "PRG-ABA",
        programName: "Applied Behavior Analysis (ABA)",
        totalSessions: 8,
        completedSessions: 2,
        startDate: migrationStart,
        firstKnownDate: migrationStart,
        lastKnownDate: addDays(migrationStart, 7),
        therapistId: state.substituteTherapistId,
        scheduleDay: "Tuesday",
        startTime: "14:00",
        duration: 60,
        roomId: "RM-006",
        goals: "Komunikasi fungsional",
      }],
    }, admin);
    expectStatus(dryRun, 201);
    const batch = unwrap(dryRun);
    assert(batch.summary.readyRows === 1 && batch.summary.blockedRows === 0, "valid migration row was not ready");
    const apply = await api("POST", `/migration/batches/${batch.id}/apply`, {}, admin);
    expectStatus(apply, 200);
    assert(unwrap(apply).summary.appliedRows === 1, "migration row was not applied");
    const repeat = await api("POST", `/migration/batches/${batch.id}/apply`, {}, admin);
    expectStatus(repeat, 200);
    assert(unwrap(repeat).summary.appliedRows === 1, "repeat migration changed applied count");
  });

  await test("REG-10", "critical therapist reassignment requires admin password", async () => {
    expectStatus(await api("POST", `/children/${state.childId}/therapist-reassignment`, {
      roleType: "primary",
      fromTherapistId: state.therapistId,
      toTherapistId: state.substituteTherapistId,
      effectiveDate: dateKey(new Date()),
      reason: "Pengujian critical decision.",
      transferFutureSessions: true,
      periodId: state.periodId,
      superAdminPassword: "wrong-password",
    }, admin), 403);
    const decision = await api("POST", `/children/${state.childId}/therapist-reassignment`, {
      roleType: "primary",
      fromTherapistId: state.therapistId,
      toTherapistId: state.substituteTherapistId,
      effectiveDate: dateKey(new Date()),
      reason: "Pengujian critical decision dengan konfirmasi admin.",
      transferFutureSessions: true,
      periodId: state.periodId,
      superAdminPassword: ADMIN_PASSWORD,
    }, admin);
    expectStatus(decision, 200);
    assert(unwrap(decision).summary?.transferredSessions >= 1, "critical reassignment did not transfer future sessions");
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    totals: {
      passed: results.filter((item) => item.status === "passed").length,
      failed: results.filter((item) => item.status === "failed").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      total: results.length,
    },
    results,
  };
  const reportDir = process.env.BLACK_BOX_REPORT_DIR || path.join(os.tmpdir(), "clinic-bbt-runtime");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportFile = path.join(reportDir, "black-box-api-results.json");
  fs.writeFileSync(reportFile, JSON.stringify(summary, null, 2));
  console.log(`RESULT ${JSON.stringify(summary.totals)} report=${reportFile}`);
  if (summary.totals.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
