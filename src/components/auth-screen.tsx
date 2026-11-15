"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Mark } from "./mark";
import { Button, Field, fieldClass } from "./ui";

export function AuthScreen({ mode }: { mode: "entrar" | "criar" }) {
  const router = useRouter();
  const creating = mode === "criar";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch(creating ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(creating ? { name, email, password, adult, consent } : { email, password }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "Não foi possível continuar.");
      return;
    }
    router.push("/app");
    router.refresh();
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted">
        <Mark className="size-7" />
        Lâmina
      </Link>
      <p className="kicker">{creating ? "Nova conta" : "Entrar"}</p>
      <h1 className="display mt-3 text-4xl">{creating ? "Sua planilha, cifrada." : "Abrir a sua planilha."}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {creating
          ? "O nome e o e-mail identificam a conta. A planilha é cifrada com uma chave sua, derivada da senha, antes de ir para o banco."
          : "A senha abre a chave da sua planilha. Sem ela, nem a gente lê os lançamentos."}
      </p>
      <form onSubmit={submit} className="mt-6 grid gap-3">
        {creating ? (
          <Field label="Nome">
            <input className={fieldClass} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
        ) : null}
        <Field label="E-mail">
          <input className={fieldClass} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Senha">
          <input
            className={fieldClass}
            type="password"
            autoComplete={creating ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {creating ? (
          <div className="grid gap-2 text-sm text-muted">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={adult} onChange={(event) => setAdult(event.target.checked)} />
              Tenho 18 anos ou mais.
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <span>
                Li os <Link href="/termos" className="text-violet-2">termos de uso</Link> e o{" "}
                <Link href="/privacidade" className="text-violet-2">aviso de privacidade</Link> e consinto o tratamento do meu nome, e-mail e da planilha financeira para organizar o meu dinheiro.
              </span>
            </label>
          </div>
        ) : null}
        {error ? <p className="text-sm text-coral">{error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Um instante…" : creating ? "Criar conta" : "Entrar"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted">
        {creating ? (
          <>
            Já tem conta? <Link href="/entrar" className="text-violet-2">Entrar</Link>
          </>
        ) : (
          <>
            Ainda não tem? <Link href="/criar-conta" className="text-violet-2">Criar conta</Link>
          </>
        )}
      </p>
    </main>
  );
}
