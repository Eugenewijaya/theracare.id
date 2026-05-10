import { and, eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { db } from "../db/index.js";
import { account, authSession } from "../db/schema.js";
import { generateId } from "../utils/id-generators.js";

export async function setCredentialPassword(userId: string, password: string) {
  const passwordHash = await hashPassword(password);
  const credentialFilter = and(eq(account.userId, userId), eq(account.providerId, "credential"));
  const credentials = await db.select().from(account).where(credentialFilter);

  if (credentials.length > 0) {
    await db.update(account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(credentialFilter);
  } else {
    await db.insert(account).values({
      id: generateId("ACC"),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    });
  }

  const updatedCredentials = await db.select().from(account).where(credentialFilter);
  const passwordChecks = await Promise.all(
    updatedCredentials.map((credential) =>
      credential.password ? verifyPassword({ hash: credential.password, password }) : false
    )
  );

  if (!passwordChecks.some(Boolean)) {
    throw new Error("Password reset failed verification");
  }

  await db.delete(authSession).where(eq(authSession.userId, userId));
}
