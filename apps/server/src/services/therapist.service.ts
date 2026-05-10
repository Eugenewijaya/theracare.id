import { db } from "../db/index.js";
import { account, authSession, notificationReads, notifications, reports, therapists, therapySessions, user } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { auth } from "../auth.js";
import { generateTempPassword, generateNIT } from "../utils/id-generators.js";
import { setCredentialPassword } from "./auth-password.service.js";

type TherapistProfileInput = {
  name?: string;
  email?: string;
  phone?: string;
  specialty?: string;
  specialization?: string;
  status?: string;
  bio?: string;
  avatar?: string;
  educationLevel?: string;
  educationField?: string;
  educationInstitution?: string;
  graduationYear?: string | number;
  strNumber?: string;
  strExpiry?: string | null;
  yearsExperience?: string;
  languages?: string;
  certifications?: Array<Record<string, unknown>>;
  schedule?: Record<string, { start?: string; end?: string }>;
  primaryRoom?: string;
  maxClients?: string | number | null;
  tempPassword?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function pickTherapistProfileValues(data: TherapistProfileInput) {
  const specialty = cleanText(data.specialty) || cleanText(data.specialization);
  const values: any = {};

  if (specialty !== undefined) values.specialty = specialty || "Therapist";
  if (typeof data.bio === "string") values.bio = data.bio.trim();
  if (typeof data.avatar === "string") values.avatar = data.avatar.trim();
  if (typeof data.educationLevel === "string") values.educationLevel = data.educationLevel.trim();
  if (typeof data.educationField === "string") values.educationField = data.educationField.trim();
  if (typeof data.educationInstitution === "string") values.educationInstitution = data.educationInstitution.trim();
  if (data.graduationYear !== undefined) values.graduationYear = String(data.graduationYear || "").trim() || null;
  if (typeof data.strNumber === "string") values.strNumber = data.strNumber.trim();
  if (data.strExpiry !== undefined) values.strExpiry = data.strExpiry || null;
  if (typeof data.yearsExperience === "string") values.yearsExperience = data.yearsExperience.trim();
  if (typeof data.languages === "string") values.languages = data.languages.trim();
  if (Array.isArray(data.certifications)) {
    values.certifications = data.certifications.filter((cert) => {
      const title = cleanText(cert?.title) || cleanText(cert?.name);
      return Boolean(title);
    });
  }
  if (data.schedule && typeof data.schedule === "object" && !Array.isArray(data.schedule)) {
    values.schedule = data.schedule;
  }
  if (typeof data.primaryRoom === "string") values.primaryRoom = data.primaryRoom.trim();
  if (data.maxClients !== undefined) {
    const parsed = data.maxClients === null || data.maxClients === "" ? null : Number(data.maxClients);
    values.maxClients = Number.isFinite(parsed) ? parsed : null;
  }

  return values;
}

function formatTherapist(therapist: any) {
  if (!therapist) return null;
  const specialty = therapist.specialty || therapist.specialization || "Therapist";
  return {
    ...therapist,
    id: therapist.id,
    nit: therapist.nit,
    userId: therapist.userId,
    name: therapist.user?.name || therapist.name || "",
    email: therapist.user?.email || therapist.email || "",
    phone: therapist.user?.phone || therapist.phone || "",
    status: therapist.user?.status || therapist.status || "active",
    specialty,
    specialization: specialty,
    bio: therapist.bio || "",
    avatar: therapist.avatar || therapist.user?.image || "",
    educationLevel: therapist.educationLevel || "",
    educationField: therapist.educationField || "",
    educationInstitution: therapist.educationInstitution || "",
    graduationYear: therapist.graduationYear || "",
    strNumber: therapist.strNumber || "",
    strExpiry: therapist.strExpiry || "",
    yearsExperience: therapist.yearsExperience || "",
    languages: therapist.languages || "",
    certifications: Array.isArray(therapist.certifications) ? therapist.certifications : [],
    schedule: therapist.schedule && typeof therapist.schedule === "object" ? therapist.schedule : {},
    primaryRoom: therapist.primaryRoom || "",
    maxClients: therapist.maxClients ?? null,
  };
}

async function archiveUser(userId: string, reason: string) {
  await db.update(user)
    .set({
      status: "deleted",
      banned: true,
      banReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
  await db.delete(authSession).where(eq(authSession.userId, userId));
}

async function deleteAuthUser(userId: string) {
  await db.delete(notificationReads).where(eq(notificationReads.userId, userId));
  await db.delete(notifications).where(eq(notifications.targetUserId, userId));
  await db.delete(authSession).where(eq(authSession.userId, userId));
  await db.delete(account).where(eq(account.userId, userId));
  await db.delete(user).where(eq(user.id, userId));
}

export const therapistService = {
  async getAll() {
    const rows = await db.query.therapists.findMany({ with: { user: true } });
    return rows.filter((row) => row.user?.status !== "deleted").map(formatTherapist);
  },

  async getById(id: string) {
    const therapist = await db.query.therapists.findFirst({
      where: eq(therapists.id, id),
      with: { user: true, sessions: true },
    });
    return formatTherapist(therapist);
  },

  async getByUserId(userId: string) {
    const therapist = await db.query.therapists.findFirst({
      where: eq(therapists.userId, userId),
      with: { user: true },
    });
    return formatTherapist(therapist);
  },

  async getLoginIdentity(nit: string) {
    const id = nit.trim().toUpperCase();
    if (!id) return null;
    const therapist = await db.query.therapists.findFirst({
      where: eq(therapists.nit, id),
      with: { user: true },
    });
    if (!therapist || therapist.user?.status !== "active") return null;
    return {
      therapistId: therapist.id,
      nit: therapist.nit,
      email: therapist.user?.email,
      name: therapist.user?.name,
      specialty: therapist.specialty,
      bio: therapist.bio,
      avatar: therapist.avatar,
    };
  },

  async create(data: TherapistProfileInput & { name: string; email: string }) {
    const tempPassword = data.tempPassword?.trim() || generateTempPassword();
    const lastSeq = await this.getLastSequence();
    const nit = generateNIT(data.name, lastSeq + 1);
    const phone = data.phone?.trim() || "";
    const profileValues = pickTherapistProfileValues(data);

    const newUser = await auth.api.createUser({
      body: {
        email: data.email,
        password: tempPassword,
        name: data.name,
        role: "therapist" as any,
        phone,
      } as any,
    });

    await db.update(user)
      .set({ phone, role: "therapist", status: "active", updatedAt: new Date() })
      .where(eq(user.id, newUser.user.id));
    const [createdUser] = await db.select().from(user).where(eq(user.id, newUser.user.id));

    const [therapist] = await db.insert(therapists).values({
      id: nit,
      userId: newUser.user.id,
      nit,
      ...profileValues,
      specialty: profileValues.specialty || "Therapist",
    }).returning();

    return { ...formatTherapist({ ...therapist, user: createdUser }), therapist, tempPassword, user: createdUser };
  },

  async updateProfile(id: string, updates: TherapistProfileInput) {
    const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, id) });
    if (!therapist) return null;

    const therapistUpdates = pickTherapistProfileValues(updates);
    if (Object.keys(therapistUpdates).length > 0) {
      await db.update(therapists).set(therapistUpdates).where(eq(therapists.id, id));
    }

    const userUpdates: any = {};
    if (typeof updates.name === "string") userUpdates.name = updates.name.trim();
    if (typeof updates.email === "string" && updates.email.trim()) userUpdates.email = updates.email.trim();
    if (typeof updates.phone === "string") userUpdates.phone = updates.phone.trim();
    if (typeof updates.avatar === "string") userUpdates.image = updates.avatar.trim();
    if (typeof updates.status === "string") userUpdates.status = updates.status;
    if (Object.keys(userUpdates).length > 0) {
      await db.update(user).set({ ...userUpdates, updatedAt: new Date() }).where(eq(user.id, therapist.userId));
    }
    return this.getById(id);
  },

  async updateStatus(id: string, status: string) {
    const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, id) });
    if (!therapist) return null;
    await db.update(user).set({ status, updatedAt: new Date() }).where(eq(user.id, therapist.userId));
    return { id, status };
  },

  async resetPassword(id: string) {
    const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, id) });
    if (!therapist) return null;
    const tempPassword = generateTempPassword();
    await setCredentialPassword(therapist.userId, tempPassword);
    return { id, tempPassword };
  },

  async delete(id: string) {
    const therapist = await db.query.therapists.findFirst({ where: eq(therapists.id, id) });
    if (!therapist) return null;

    const session = await db.query.therapySessions.findFirst({ where: eq(therapySessions.therapistId, id) });
    if (session) {
      await archiveUser(therapist.userId, "Therapist account archived by admin while therapy sessions still exist.");
      return { deleted: true, archived: true, id, reason: "Akun terapis diarsipkan karena masih memiliki sesi terapi." };
    }

    const report = await db.query.reports.findFirst({ where: eq(reports.therapistId, id) });
    if (report) {
      await archiveUser(therapist.userId, "Therapist account archived by admin while therapy reports still exist.");
      return { deleted: true, archived: true, id, reason: "Akun terapis diarsipkan karena masih memiliki laporan terapi." };
    }

    await db.delete(therapists).where(eq(therapists.id, id));
    await deleteAuthUser(therapist.userId);
    return { deleted: true, id };
  },

  async getLastSequence() {
    const all = await db.select({ nit: therapists.nit }).from(therapists);
    if (all.length === 0) return 0;
    const nums = all.map((t) => parseInt(t.nit.slice(-3), 10)).filter(n => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : 0;
  },
};
