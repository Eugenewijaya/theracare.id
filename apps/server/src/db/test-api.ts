/**
 * End-to-end API test script — cookie-based auth with Origin header
 */
const BASE = "http://localhost:3000/api";
const ORIGIN = "http://localhost:5173";
let cookie = "";

async function api(method: string, path: string, body?: any, useAuth = true) {
  const h: Record<string, string> = { "Content-Type": "application/json", "Origin": ORIGIN };
  if (useAuth && cookie) h["Cookie"] = cookie;
  const r = await fetch(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const sc = r.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const t = await r.text();
  let d: any = {}; try { d = JSON.parse(t); } catch { d = { raw: t }; }
  return { status: r.status, data: d };
}

async function test() {
  console.log("═══════════════════════════════════════════");
  console.log("  TheraCare API — End-to-End Test");
  console.log("═══════════════════════════════════════════\n");
  let p = 0, f = 0;
  const ok = (n: string, v: boolean) => { if (v) { p++; console.log(`  ✅ ${n}`); } else { f++; console.log(`  ❌ ${n}`); } };

  // 1. Health
  console.log("📋 1. Health");
  const h = await api("GET", "/health", undefined, false);
  ok("Health → 200", h.status === 200);

  // 2. Admin Login
  console.log("\n🔑 2. Admin Login");
  const login = await api("POST", "/auth/sign-in/email", { email: "admin@theracare.com", password: "TheraCare@Admin2026" }, false);
  ok("Login → 200 + user", login.status === 200 && !!login.data?.user);
  ok("Role = admin", login.data?.user?.role === "admin");
  ok("Cookie set", !!cookie);

  // 3. Auth guard
  console.log("\n🔒 3. Auth Guard");
  const noAuth = await api("GET", "/parents", undefined, false);
  ok("No cookie → 401", noAuth.status === 401);

  // 4. Seeded data
  console.log("\n📦 4. Seeded Data");
  const prog = await api("GET", "/admin/programs");
  ok(`Programs: ${prog.data?.data?.length}`, prog.data?.data?.length === 6);
  const rm = await api("GET", "/admin/rooms");
  ok(`Rooms: ${rm.data?.data?.length}`, rm.data?.data?.length === 8);

  // 5. Create Parent
  console.log("\n👨‍👩‍👧 5. Create Parent");
  const pr = await api("POST", "/parents", { name: "Budi Santoso", email: "budi2@email.com", phone: "6281234560011", address: "Jakarta" });
  ok("Create → 201", pr.status === 201);
  const pid = pr.data?.data?.parent?.id;
  const ppw = pr.data?.data?.tempPassword;
  ok(`Parent ID: ${pid}`, !!pid);
  ok(`Temp PW: ${ppw}`, !!ppw);

  // 6. Create Child
  console.log("\n👶 6. Create Child");
  const cr = await api("POST", "/children", { parentId: pid, firstName: "Andi", lastName: "Santoso", dob: "2020-05-15", gender: "male", diagnosis: "ASD", therapyProgramsList: [{ type: "OT", totalSessions: 24, goal: "Motorik" }] });
  ok("Create → 201", cr.status === 201);
  const cid = cr.data?.data?.id;
  ok(`NITA: ${cid}`, !!cid);

  // 7. Children by parent
  console.log("\n📋 7. Parent-Child Link");
  const cl = await api("GET", `/children/by-parent/${pid}`);
  ok("1 child linked", cl.data?.data?.length === 1);

  // 8. Create Therapist
  console.log("\n🧑‍⚕️ 8. Create Therapist");
  const tr = await api("POST", "/therapists", { name: "Sarah Wijaya", email: "sarah2@theracare.com", phone: "6281234560022", specialty: "OT" });
  ok("Create → 201", tr.status === 201);
  const tid = tr.data?.data?.therapist?.id;
  const tpw = tr.data?.data?.tempPassword;
  ok(`NIT: ${tid}`, !!tid);

  // 9. Create Session
  console.log("\n📅 9. Create Session");
  if (tid && cid) {
    const sr = await api("POST", "/sessions", { therapistId: tid, childId: cid, date: "2026-05-06", startTime: "09:00", focus: "Fine Motor", roomId: "RM-001" });
    ok("Create → 201", sr.status === 201);
    ok(`Session ID: ${sr.data?.data?.id}`, !!sr.data?.data?.id);

    // 10. Session queries
    console.log("\n📋 10. Session Queries");
    const ts = await api("GET", `/sessions/therapist/${tid}`);
    ok("Therapist sessions >= 1", ts.data?.data?.length >= 1);
    const cu = await api("GET", `/sessions/child/${cid}/upcoming`);
    ok("Child upcoming >= 1", cu.data?.data?.length >= 1);
  }

  // 11. Stats
  console.log("\n📊 11. Dashboard Stats");
  const st = await api("GET", "/admin/stats");
  ok("Stats → 200", st.status === 200);
  ok(`Children: ${st.data?.data?.activeChildren}`, st.data?.data?.activeChildren >= 1);
  ok(`Therapists: ${st.data?.data?.totalTherapists}`, st.data?.data?.totalTherapists >= 1);

  // 12. Notifications
  console.log("\n🔔 12. Notifications");
  const nf = await api("GET", "/notifications");
  ok("Notifications → 200", nf.status === 200);
  const uc = await api("GET", "/notifications/unread-count");
  ok("Unread count → 200", uc.status === 200);

  // 13. Parent Login
  if (ppw) {
    console.log("\n🔑 13. Parent Login");
    const pl = await api("POST", "/auth/sign-in/email", { email: "budi2@email.com", password: ppw }, false);
    ok("Parent login works", !!pl.data?.user);
    ok("Role = parent", pl.data?.user?.role === "parent");
  }

  // 14. Therapist Login
  if (tpw) {
    console.log("\n🔑 14. Therapist Login");
    const tl = await api("POST", "/auth/sign-in/email", { email: "sarah2@theracare.com", password: tpw }, false);
    ok("Therapist login works", !!tl.data?.user);
    ok("Role = therapist", tl.data?.user?.role === "therapist");
  }

  console.log("\n═══════════════════════════════════════════");
  console.log(`  Results: ${p} passed, ${f} failed`);
  console.log("═══════════════════════════════════════════\n");
  process.exit(f > 0 ? 1 : 0);
}

test().catch(e => { console.error("❌", e.message); process.exit(1); });
