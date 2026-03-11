"use server";

import { z } from "zod";

import { getServerAuthSession } from "~/server/auth";
import { hashPassword, setPasswordHashByUserId } from "~/server/auth/password";

const setPasswordSchema = z
  .object({
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "As senhas precisam ser iguais.",
    path: ["confirmPassword"],
  });

export type SetPasswordState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function setPasswordAction(
  _previousState: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "Faca login antes de definir uma senha local.",
    };
  }

  const parsed = setPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Nao foi possivel salvar a senha.",
    };
  }

  await setPasswordHashByUserId(
    session.user.id,
    await hashPassword(parsed.data.password),
  );

  return {
    status: "success",
    message: "Senha local salva. Agora voce pode entrar com email e senha tambem.",
  };
}
