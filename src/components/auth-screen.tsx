"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Mark } from "./mark";
import { Button, Field, fieldClass } from "./ui";

type Reply = { error?: string; blocked?: boolean; adminCode?: boolean } | null;

export function AuthScreen({ mode }: { mode: "entrar" | "criar" }) {
  const router = useRouter();
  const creating = mode === "criar";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [askCode, setAskCode] = useState(false);
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [erased, setErased] = useState(false);

  const post = async (url: string, payload: unknown): Promise<{ ok: boolean; body: Reply }> => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: response.ok, body: (await response.json().catch(() => null)) as Reply };
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { ok, body } = creating
        ? await post("/api/auth/register", { name, email, password, adult, consent, adminCode: adminCode || undefined })
        : await post("/api/auth/login", { email, password });
      if (!ok) {
        if (body?.adminCode) setAskCode(true);
        if (body?.blocked) setBlocked(true);
        setError(body?.error ?? "Não foi possível continuar.");
        return;
      }
      router.push("/app");
    } catch {
      setError("Sem conexão. Confira a internet e tente de novo.");
    } finally {
      setPending(false);
    }
  };

  const erase = async () => {
    if (!window.confirm("Apagar a conta e a planilha cifrada? Isso não pode ser desfeito.")) return;
    setPending(true);
    setError(null);
    try {
      const { ok, body } = await post("/api/account/delete", { email, password });
      if (!ok) {
        setError(body?.error ?? "Não apagou a conta.");
        return;
      }
      setErased(true);
      setBlocked(false);
      setPassword("");
    } catch {
      setError("Sem conexão. Confira a internet e tente de novo.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative h-dvh overflow-y-auto">
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted">
        <Mark className="size-7" />
        Lâmina
      </Link>
      <h1 className="display text-4xl">{creating ? "Sua planilha, cifrada." : "Abrir a sua planilha."}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {creating
          ? "O nome e o e-mail identificam a conta. A planilha é cifrada com uma chave sua, derivada da senha, antes de ir para o banco."
          : "A senha abre a chave da sua planilha. Sem ela, nem a gente lê os lançamentos."}
      </p>
      {erased ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-4 text-sm text-ink" role="status">
          Conta e planilha apagadas.
        </p>
      ) : null}
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
          <p className="-mt-1 text-xs leading-relaxed text-muted">
            Pelo menos 10 caracteres. A senha é a chave da planilha: se você esquecer, não há como recuperar os lançamentos.
          </p>
        ) : null}
        {creating && askCode ? (
          <Field label="Código de administração">
            <input className={fieldClass} autoComplete="off" value={adminCode} onChange={(event) => setAdminCode(event.target.value)} />
          </Field>
        ) : null}
        {creating ? (
          <div className="grid gap-2 text-sm text-muted">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5 size-4" checked={adult} onChange={(event) => setAdult(event.target.checked)} />
              Tenho 18 anos ou mais.
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5 size-4" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <span>
                Li os <Link href="/termos" className="text-violet-2">termos de uso</Link> e o{" "}
                <Link href="/privacidade" className="text-violet-2">aviso de privacidade</Link> e consinto o tratamento do meu nome, e-mail e da planilha financeira para organizar o meu dinheiro.
              </span>
            </label>
          </div>
        ) : null}
        {error ? (
          <p className="text-sm text-coral" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Um instante…" : creating ? "Criar conta" : "Entrar"}
        </Button>
      </form>
      {blocked && !creating ? (
        <div className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-muted">
          O acesso desta conta está pausado pelo administrador. Você ainda pode apagar a conta e a planilha com o e-mail e a senha acima.
          <Button type="button" tone="ghost" className="mt-3 w-full text-coral" disabled={pending} onClick={() => void erase()}>
            Apagar a conta
          </Button>
        </div>
      ) : null}
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
    </div>
  );
}
