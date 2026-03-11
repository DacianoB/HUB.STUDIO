"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  setPasswordAction,
  type SetPasswordState,
} from "~/app/auth/set-password/actions";

const initialState: SetPasswordState = {
  status: "idle",
};

function SubmitButton({ hasPassword }: { hasPassword: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending
        ? "Salvando..."
        : hasPassword
          ? "Atualizar senha"
          : "Definir senha"}
    </button>
  );
}

export function SetPasswordForm({
  email,
  hasPassword,
}: {
  email: string;
  hasPassword: boolean;
}) {
  const [state, formAction] = useActionState(setPasswordAction, initialState);

  return (
    <section className="w-full rounded-xl border border-white/10 bg-card p-6 text-white">
      <h1 className="mb-1 text-2xl font-bold">
        {hasPassword ? "Atualizar senha" : "Definir senha local"}
      </h1>
      <p className="mb-2 text-sm text-muted-foreground">
        Sua conta conectada esta vinculada a <strong>{email}</strong>.
      </p>
      <p className="mb-6 text-sm text-muted-foreground">
        {hasPassword
          ? "Troque sua senha para continuar entrando com email e senha."
          : "Depois de salvar, voce podera usar Google ou email e senha para entrar."}
      </p>

      <form action={formAction} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Nova senha</span>
          <input
            type="password"
            name="password"
            minLength={8}
            required
            placeholder="Minimo de 8 caracteres"
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-0 focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            Confirmar senha
          </span>
          <input
            type="password"
            name="confirmPassword"
            minLength={8}
            required
            placeholder="Repita sua nova senha"
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-0 focus:border-primary"
          />
        </label>

        {state.message ? (
          <p
            className={`text-xs ${
              state.status === "success" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {state.message}
          </p>
        ) : null}

        <SubmitButton hasPassword={hasPassword} />
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link href="/" className="text-primary hover:underline">
          Voltar para o app
        </Link>
      </p>
    </section>
  );
}
