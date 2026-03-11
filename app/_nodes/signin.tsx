"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, useEffect, useMemo, useState } from "react";

interface SignInProps {
  mini?: boolean;
}

export function SignIn({ mini = false }: SignInProps) {
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(() => searchParams.get("callbackUrl") ?? "/", [searchParams]);
  const authError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() =>
    authError === "CredentialsSignin" ? "Email ou senha invalidos." : "",
  );
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  useEffect(() => {
    setError(authError === "CredentialsSignin" ? "Email ou senha invalidos." : "");
  }, [authError]);

  const handleCredentialsLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsLoadingCredentials(true);

    const response = await fetch("/api/auth/local-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        callbackUrl,
      }),
    });
    const result = (await response.json().catch(() => null)) as
      | {
          ok?: boolean;
          url?: string;
          message?: string;
        }
      | null;

    setIsLoadingCredentials(false);

    if (!response.ok || !result?.ok) {
      setError(result?.message ?? "Email ou senha invalidos.");
      return;
    }

    window.location.assign(result.url ?? callbackUrl);
  };

  const handleGoogleLogin = async () => {
    setIsLoadingGoogle(true);
    await signIn("google", { callbackUrl });
  };

  return (
    <section className="w-full rounded-xl border border-white/10 bg-card p-6 text-white">
      {!mini && <h1 className="mb-1 text-2xl font-bold">Entrar</h1>}
      <p className="mb-6 text-sm text-muted-foreground">
        Acesse sua conta com Google ou email e senha. No primeiro acesso com email,
        criamos sua conta local.
      </p>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoadingGoogle}
        className="mb-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoadingGoogle ? "Conectando..." : "Continuar com Google"}
      </button>

      <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleCredentialsLogin} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@exemplo.com"
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-0 focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Senha</span>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            placeholder="Minimo de 8 caracteres"
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-0 focus:border-primary"
          />
        </label>

        {error ? <p className="text-xs text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={isLoadingCredentials}
          className="h-11 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoadingCredentials ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Ao continuar, voce concorda com a{" "}
        <Link href="/privacidade" className="text-primary hover:underline">
          politica de privacidade
        </Link>
        .
      </p>
    </section>
  );
}
