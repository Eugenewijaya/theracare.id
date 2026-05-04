import "dotenv/config";
import { db, pool } from "./index.js";
import { auth } from "../auth.js";
import * as schema from "./schema.js";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding TheraCare database...\n");

  // ── 1. Create Admin User ──
  console.log("1️⃣  Creating admin user...");
  const adminEmail = process.env.ADMIN_EMAIL || "admin@theracare.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "TheraCare@Admin2026";
  const adminName = process.env.ADMIN_NAME || "Admin TheraCare";

  try {
    await auth.api.signUpEmail({
      body: { email: adminEmail, password: adminPassword, name: adminName },
    });
    // Update role to admin
    await db
      .update(schema.user)
      .set({ role: "admin", phone: "6281234567890" })
      .where(eq(schema.user.email, adminEmail));
    console.log(`   ✅ Admin created: ${adminEmail}`);
  } catch (e: any) {
    console.log(`   ⚠️  Admin may already exist: ${e.message || "skipped"}`);
  }

  // ── 2. Seed Programs ──
  console.log("2️⃣  Seeding programs...");
  const programData = [
    { id: "PRG-OT", name: "Occupational Therapy (OT)", code: "OT", target: "Fine Motor & Daily Living", duration: 60, goals: ["Hand-eye coordination", "Sensory processing", "Self-care routines"] },
    { id: "PRG-ST", name: "Speech & Language Therapy (ST)", code: "ST", target: "Communication & Speech", duration: 45, goals: ["Articulation", "Language expression", "Social communication"] },
    { id: "PRG-ABA", name: "Applied Behavior Analysis (ABA)", code: "ABA", target: "Behavioral & Social Skills", duration: 120, goals: ["Positive behavior reinforcement", "Social interaction", "Functional communication"] },
    { id: "PRG-PT", name: "Physical Therapy (PT)", code: "PT", target: "Gross Motor & Mobility", duration: 60, goals: ["Balance and coordination", "Strength and endurance", "Posture control"] },
    { id: "PRG-SI", name: "Sensory Integration (SI)", code: "SI", target: "Sensory Processing", duration: 45, goals: ["Vestibular input", "Proprioceptive awareness", "Tactile modulation"] },
    { id: "PRG-SSG", name: "Social Skills Group (SSG)", code: "SSG", target: "Peer Interaction", duration: 90, goals: ["Turn-taking", "Emotional regulation", "Collaborative play"] },
  ];
  for (const p of programData) {
    await db.insert(schema.programs).values(p).onConflictDoNothing();
  }
  console.log(`   ✅ ${programData.length} programs seeded`);

  // ── 3. Seed Rooms ──
  console.log("3️⃣  Seeding rooms...");
  const roomData = [
    { id: "RM-001", name: "Ruang OT 1", type: "Occupational Therapy", capacity: 1 },
    { id: "RM-002", name: "Ruang OT 2", type: "Occupational Therapy", capacity: 1 },
    { id: "RM-003", name: "Ruang ST A", type: "Speech Therapy", capacity: 1 },
    { id: "RM-004", name: "Ruang ST B", type: "Speech Therapy", capacity: 1 },
    { id: "RM-005", name: "Ruang Sensori", type: "Sensory Integration", capacity: 2 },
    { id: "RM-006", name: "Ruang ABA", type: "ABA Therapy", capacity: 1 },
    { id: "RM-007", name: "Ruang PT", type: "Physical Therapy", capacity: 2 },
    { id: "RM-008", name: "Ruang Grup", type: "Social Skills Group", capacity: 6 },
  ];
  for (const r of roomData) {
    await db.insert(schema.rooms).values({ ...r, status: "active" }).onConflictDoNothing();
  }
  console.log(`   ✅ ${roomData.length} rooms seeded`);

  // ── 4. Seed Settings ──
  console.log("4️⃣  Seeding clinic settings...");
  await db.insert(schema.clinicSettings)
    .values({ key: "adminWhatsApp", value: "6281234567890", updatedAt: new Date() })
    .onConflictDoNothing();
  console.log("   ✅ Settings seeded");

  console.log("\n🎉 Seed completed!\n");
  console.log(`   Admin Email:    ${adminEmail}`);
  console.log(`   Admin Password: ${adminPassword}\n`);

  await pool.end();
  process.exit(0);
}

seed().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
