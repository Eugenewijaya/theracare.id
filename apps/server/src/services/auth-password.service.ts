import { and, eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { db } from "../db/index.js";
import { account, authSession } from "../db/schema.js";
import { generateId } from "../utils/id-generators.js";

export async function verifyCredentialPassword(userId: string, password: string) {
  const credentialRows = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
  const credentials = credentialRows.length > 0
    ? credentialRows
    : await db.select().from(account).where(eq(account.userId, userId));
  const passwordChecks = await Promise.all(
    credentials.map((credential) =>
      credential.password ? verifyPassword({ hash: credential.password, password }) : false
    )
  );
  return passwordChecks.some(Boolean);
}

export async function setCredentialPassword(userId: string, password: string) {
  const passwordHash = await hashPassword(password);
  const userAccountFilter = eq(account.userId, userId);
  const credentials = await db.select().from(account).where(userAccountFilter);

  if (credentials.length > 0) {
    await db.update(account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(userAccountFilter);
  } else {
    await db.insert(account).values({
      id: generateId("ACC"),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    });
  }

  if (!(await verifyCredentialPassword(userId, password))) {
    throw new Error("Password reset failed verification");
  }

  await db.delete(authSession).where(eq(authSession.userId, userId));
}
