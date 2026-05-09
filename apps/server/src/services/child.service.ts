import { db } from "../db/index.js";
import { children, clinicSettings, reports, rescheduleRequests, sessionRatings, therapyPrograms, therapySessions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateNITA } from "../utils/id-generators.js";

const CHILD_PHOTO_SETTINGS_KEY = "childPhotoUrls";

function parseChildPhotoMap(value?: string | null): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, url]) => typeof url === "string" && url.trim())
        .map(([id, url]) => [id, String(url).trim()])
    );
  } catch {
    return {};
  }
}

export async function getChildPhotoUrlMap() {
  const row = await db.query.clinicSettings.findFirst({
    where: eq(clinicSettings.key, CHILD_PHOTO_SETTINGS_KEY),
  });
  return parseChildPhotoMap(row?.value);
}

export function attachChildPhotoUrl<T extends { id?: string | null; nita?: string | null }>(child: T | null | undefined, photoMap: Record<string, string>) {
  if (!child) return child;
  const photoUrl = (child.id && photoMap[child.id]) || (child.nita && photoMap[child.nita]) || "";
  return { ...child, photoUrl };
}

async function enrichChildList<T extends { id?: string | null; nita?: string | null }>(list: T[]) {
  const photoMap = await getChildPhotoUrlMap();
  return list.map((child) => attachChildPhotoUrl(child, photoMap));
}

export const childService = {
  async getAll() {
    const rows = await db.query.children.findMany({
      with: { parent: true, therapyPrograms: true },
    });
    return enrichChildList(rows);
  },

  async getById(id: string) {
    const child = await db.query.children.findFirst({
      where: eq(children.id, id),
      with: { parent: true, therapyPrograms: true, sessions: true },
    });
    const photoMap = await getChildPhotoUrlMap();
    return attachChildPhotoUrl(child, photoMap);
  },

  async getByParent(parentId: string) {
    const rows = await db.query.children.findMany({
      where: eq(children.parentId, parentId),
      with: { therapyPrograms: true },
    });
    return enrichChildList(rows);
  },

  async create(parentId: string, data: {
    firstName: string; lastName: string; dob?: string;
    gender?: string; school?: string; diagnosis?: string;
    therapyProgramsList?: Array<{ type: string; totalSessions: number; goal?: string; icon?: string; colorClass?: string; colorHex?: string; programId?: string }>;
  }) {
    const lastSeq = await this.getLastSequence();
    const nita = generateNITA(lastSeq + 1);

    const [child] = await db.insert(children).values({
      id: nita,
      nita,
      parentId,
      firstName: data.firstName,
      lastName: data.lastName,
      name: `${data.firstName} ${data.lastName}`,
      dob: data.dob,
      gender: data.gender,
      school: data.school,
      diagnosis: data.diagnosis,
    }).returning();

    // Insert therapy programs if provided
    if (data.therapyProgramsList && data.therapyProgramsList.length > 0) {
      await db.insert(therapyPrograms).values(
        data.therapyProgramsList.map((tp) => ({
          childId: nita,
          programId: tp.programId || null,
          type: tp.type,
          totalSessions: tp.totalSessions,
          goal: tp.goal || "",
          icon: tp.icon,
          colorClass: tp.colorClass,
          colorHex: tp.colorHex,
        }))
      );
    }

    return child;
  },

  async update(id: string, updates: Partial<{
    firstName: string; lastName: string; dob: string;
    gender: string; school: string; diagnosis: string; status: string;
  }>) {
    const name = updates.firstName || updates.lastName
      ? `${updates.firstName || ""} ${updates.lastName || ""}`.trim()
      : undefined;

    const [updated] = await db.update(children)
      .set({ ...updates, ...(name ? { name } : {}) })
      .where(eq(children.id, id))
      .returning();
    return updated;
  },

  async updatePhoto(id: string, photoUrl: string) {
    const child = await db.query.children.findFirst({ where: eq(children.id, id) });
    if (!child) return null;

    const photoMap = await getChildPhotoUrlMap();
    photoMap[child.id] = photoUrl.trim();
    if (child.nita) photoMap[child.nita] = photoUrl.trim();

    await db.insert(clinicSettings)
      .values({ key: CHILD_PHOTO_SETTINGS_KEY, value: JSON.stringify(photoMap), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: clinicSettings.key,
        set: { value: JSON.stringify(photoMap), updatedAt: new Date() },
      });

    return this.getById(id);
  },

  async delete(id: string) {
    const child = await db.query.children.findFirst({ where: eq(children.id, id) });
    if (!child) return null;

    const session = await db.query.therapySessions.findFirst({ where: eq(therapySessions.childId, id) });
    if (session) return { blocked: true, reason: "Anak masih memiliki sesi terapi." };

    const report = await db.query.reports.findFirst({ where: eq(reports.childId, id) });
    if (report) return { blocked: true, reason: "Anak masih memiliki laporan terapi." };

    const reschedule = await db.query.rescheduleRequests.findFirst({ where: eq(rescheduleRequests.childId, id) });
    if (reschedule) return { blocked: true, reason: "Anak masih memiliki permintaan reschedule." };

    const rating = await db.query.sessionRatings.findFirst({ where: eq(sessionRatings.childId, id) });
    if (rating) return { blocked: true, reason: "Anak masih memiliki rating sesi." };

    await db.delete(therapyPrograms).where(eq(therapyPrograms.childId, id));
    await db.delete(children).where(eq(children.id, id));
    return { deleted: true, id };
  },

  async getLastSequence() {
    const all = await db.select({ nita: children.nita }).from(children);
    if (all.length === 0) return 0;
    const nums = all.map((c) => parseInt(c.nita.slice(-3), 10)).filter(n => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : 0;
  },
};
