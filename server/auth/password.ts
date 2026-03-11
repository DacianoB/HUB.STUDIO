import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { Prisma } from "@prisma/client";

import { db } from "~/server/db";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const storedKey = Buffer.from(hash, "hex");
  const derivedKey = (await scrypt(password, salt, storedKey.length)) as Buffer;

  if (storedKey.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedKey, derivedKey);
}

export async function getPasswordHashByUserId(
  userId: string,
): Promise<string | null> {
  const rows = await db.$queryRaw<Array<{ passwordHash: string | null }>>(
    Prisma.sql`SELECT "passwordHash" FROM "User" WHERE "id" = ${userId} LIMIT 1`,
  );

  return rows[0]?.passwordHash ?? null;
}

export async function setPasswordHashByUserId(
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db.$executeRaw(
    Prisma.sql`UPDATE "User" SET "passwordHash" = ${passwordHash} WHERE "id" = ${userId}`,
  );
}
