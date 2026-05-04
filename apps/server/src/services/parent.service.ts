import { db } from "../db/index.js";
import { parents, user, children } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { auth } from "../auth.js";
import { generateTempPassword, generateSeqId } from "../utils/id-generators.js";

export const parentService = {
  async getAll() {
    return db.query.parents.findMany({
      with: { user: true, children: true },
    });
  },

  async getById(id: string) {
    return db.query.parents.findFirst({
      where: eq(parents.id, id),
      with: { user: true, children: true },
    });
  },

  async getByUserId(userId: string) {
    return db.query.parents.findFirst({
      where: eq(parents.userId, userId),
      with: { user: true, children: true },
    });
  },

  async create(data: { name: string; email: string; phone?: string; address?: string }, lastId: number) {
    const tempPassword = generateTempPassword();
    const parentId = generateSeqId("P", lastId + 1);

    // Create Better Auth user
    const newUser = await auth.api.createUser({
      body: {
        email: data.email,
        password: tempPassword,
        name: data.name,
        role: "parent",
        phone: data.phone || "",
      },
    });

    // Create parent record
    const [parent] = await db.insert(parents).values({
      id: parentId,
      userId: newUser.user.id,
      address: data.address || "",
    }).returning();

    return { parent, tempPassword, user: newUser.user };
  },

  async updateStatus(id: string, status: string) {
    const parent = await db.query.parents.findFirst({ where: eq(parents.id, id) });
    if (!parent) return null;
    await db.update(user).set({ status, updatedAt: new Date() }).where(eq(user.id, parent.userId));
    return { id, status };
  },

  async resetPassword(id: string) {
    const parent = await db.query.parents.findFirst({ where: eq(parents.id, id) });
    if (!parent) return null;
    const tempPassword = generateTempPassword();
    await auth.api.setPassword({ body: { userId: parent.userId, newPassword: tempPassword } } as any);
    return { id, tempPassword };
  },

  async getLastId() {
    const all = await db.select({ id: parents.id }).from(parents);
    if (all.length === 0) return 0;
    const nums = all.map((p) => parseInt(p.id.replace("P-", ""), 10)).filter(n => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : 0;
  },
};
