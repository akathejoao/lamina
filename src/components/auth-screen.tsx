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
  const [codeOpen, setCodeOpen] = useState(false);
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

  const exportData = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/account/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as Reply;
        setError(body?.error ?? "Não baixou os dados.");
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "lamina-meus-dados.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Sem conexão. Confira a internet e tente de novo.");
    } finally {
      setPending(false);
    }
  };

  const showCode = askCode || codeOpen;

  return (
    <div className="relative grid h-dvh grid-cols-1 overflow-hidden lg:grid-cols-2">
      <main className="min-h-0 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-8 lg:py-10">
          <Link href="/" className="display mb-8 inline-flex min-h-10 items-center gap-2 self-start text-xl">
            <Mark className="size-7" />
            Lâmina
          </Link>
          <p className="col-label" aria-hidden="true">{creating ? "A  NOVA PLANILHA" : "A  ABRIR PLANILHA"}</p>
          <h1 className="display mt-3 text-4xl sm:text-5xl">{creating ? "Sua planilha, cifrada." : "Abrir a sua planilha."}</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {creating
              ? "O nome e o e-mail identificam a conta. A planilha é cifrada com uma chave sua, derivada da senha, antes de ir para o banco."
              : "A senha abre a chave da sua planilha. Sem ela, nem a gente lê os lançamentos."}
          </p>
          {erased ? (
            <p className="mt-6 border-l-2 border-mint pl-3 text-sm text-ink" role="status">
              Conta e planilha apagadas.
            </p>
          ) : null}
          <form onSubmit={submit} className="mt-6 grid gap-3 border-t border-line pt-6">
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
            {creating && !showCode ? (
              <button
                type="button"
                aria-expanded={false}
                onClick={() => setCodeOpen(true)}
                className="tint -mt-1 inline-flex min-h-10 items-center self-start text-sm text-violet-2 hover:text-ink"
              >
                Tenho um código de administração
              </button>
            ) : null}
            {creating && showCode ? (
              <Field label="Código de administração">
                <input className={fieldClass} autoComplete="off" value={adminCode} onChange={(event) => setAdminCode(event.target.value)} />
              </Field>
            ) : null}
            {creating ? (
              <div className="grid gap-2 text-sm text-muted">
                <label className="flex min-h-10 items-start gap-3">
                  <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={adult} onChange={(event) => setAdult(event.target.checked)} />
                  Tenho 18 anos ou mais.
                </label>
                <label className="flex min-h-10 items-start gap-3">
                  <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                  <span>
                    Li os <Link href="/termos" className="text-violet-2 underline underline-offset-2">termos de uso</Link> e o{" "}
                    <Link href="/privacidade" className="text-violet-2 underline underline-offset-2">aviso de privacidade</Link> e consinto o tratamento do meu nome, e-mail e da planilha financeira para organizar o meu dinheiro.
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
            <div className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-muted">
              O acesso desta conta está pausado pelo administrador. Você ainda pode baixar os seus dados ou apagar a conta e a planilha com o e-mail e a senha acima.
              <Button type="button" tone="ghost" className="mt-3 w-full" disabled={pending} onClick={() => void exportData()}>
                Baixar meus dados
              </Button>
              <Button type="button" tone="ghost" className="mt-2 w-full text-coral" disabled={pending} onClick={() => void erase()}>
                Apagar a conta
              </Button>
            </div>
          ) : null}
          <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-muted">
            {creating ? (
              <>
                Já tem conta? <Link href="/entrar" className="inline-flex min-h-10 items-center text-violet-2 hover:text-ink">Entrar</Link>
              </>
            ) : (
              <>
                Ainda não tem? <Link href="/criar-conta" className="inline-flex min-h-10 items-center text-violet-2 hover:text-ink">Criar conta</Link>
              </>
            )}
          </p>
        </div>
      </main>

      <LedgerPreview creating={creating} />
    </div>
  );
}

// Lado direito em telas largas: uma folha pautada, só de enfeite, para a conta parecer um livro-caixa prestes a abrir.
const SAMPLE: [string, string, string, boolean][] = [
  ["01", "Salário", "+R$ 5.400,00", true],
  ["03", "Aluguel", "−R$ 1.850,00", false],
  ["05", "Mercado", "−R$ 312,40", false],
  ["09", "Freelance", "+R$ 400,00", true],
  ["12", "Netflix", "−R$ 55,90", false],
  ["14", "Reserva", "−R$ 600,00", false],
];

function LedgerPreview({ creating }: { creating: boolean }) {
  return (
    <aside className="relative hidden min-h-0 items-center justify-center overflow-hidden border-l border-line bg-canvas-2 px-10 lg:flex" aria-hidden="true">
      <div className="sheet-grid absolute inset-0" />
      <div className="relative w-full max-w-md">
        <div className="blade rounded-lg border border-line bg-canvas">
          <div className="col-label grid grid-cols-[3.5rem_1fr_auto] gap-x-3 border-b border-line px-4 py-2.5">
            <span>A&nbsp;&nbsp;DATA</span>
            <span>B&nbsp;&nbsp;DESCRIÇÃO</span>
            <span>C&nbsp;&nbsp;VALOR</span>
          </div>
          <div className="ruled">
            {SAMPLE.map(([day, title, value, income]) => (
              <div key={title} className="grid grid-cols-[3.5rem_1fr_auto] items-baseline gap-x-3 px-4 py-2.5 text-sm">
                <span className="num text-xs text-faint">{day}/11</span>
                <span className="text-muted">{title}</span>
                <span className={`num ${income ? "text-mint" : "text-ink"}`}>{value}</span>
              </div>
            ))}
            <div className="grid grid-cols-[3.5rem_1fr_auto] items-baseline gap-x-3 border-t-ink/40 bg-surface-2/60 px-4 py-3 text-sm">
              <span className="num text-xs text-faint">fx</span>
              <span>Livre no mês</span>
              <span className="num rounded-sm border border-violet-2 px-1.5 text-ink">R$ 2.981,70</span>
            </div>
          </div>
        </div>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
          {creating ? "Exemplo. Os valores de verdade só existem na sua conta, cifrados com a sua senha." : "Exemplo de planilha. A sua abre aqui, depois da senha."}
        </p>
      </div>
    </aside>
  );
}
