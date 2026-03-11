import { z } from "zod";

import {
  getPasswordHashByUserId,
  hashPassword,
  setPasswordHashByUserId,
  verifyPassword,
} from "~/server/auth/password";
import { db } from "~/server/db";

export const localCredentialsSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72),
});

export async function authenticateLocalUser(input: unknown) {
  const parsed = localCredentialsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      code: "INVALID_INPUT" as const,
      message: "Informe um email valido e uma senha com pelo menos 8 caracteres.",
    };
  }

  const { email, password } = parsed.data;
  const existingUser = await db.user.findUnique({
    where: { email },
  });

  if (!existingUser) {
    const user = await db.user.create({
      data: {
        email,
        name: email.split("@")[0] ?? "User",
      },
    });

    await setPasswordHashByUserId(user.id, await hashPassword(password));

    return {
      ok: true as const,
      user,
      isNewUser: true as const,
    };
  }

  const passwordHash = await getPasswordHashByUserId(existingUser.id);

  if (!passwordHash) {
    return {
      ok: false as const,
      code: "PASSWORD_NOT_SET" as const,
      message: "Esta conta ainda nao tem senha local. Entre com Google para definir uma senha.",
    };
  }

  const isValidPassword = await verifyPassword(password, passwordHash);

  if (!isValidPassword) {
    return {
      ok: false as const,
      code: "INVALID_CREDENTIALS" as const,
      message: "Email ou senha invalidos.",
    };
  }

  return {
    ok: true as const,
    user: existingUser,
    isNewUser: false as const,
  };
}
