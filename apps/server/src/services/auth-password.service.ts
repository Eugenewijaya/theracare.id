import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "../db/index.js";
import { account, authSession } from "../db/schema.js";
import { generateId } from "../utils/id-generators.js";

export async function setCredentialPassword(userId: string, password: string) {
  const passwordHash = await hashPassword(password);
  const existing = await db.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, "credential")),
  });

  if (existing) {
    await db.update(account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(eq(account.id, existing.id));
  } else {
    await db.insert(account).values({
      id: generateId("ACC"),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    });
  }

  await db.delete(authSession).where(eq(authSession.userId, userId));
}
