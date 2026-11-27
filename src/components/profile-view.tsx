"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { goalProgress, health, patrimony, streak } from "@/lib/finance";
import { formatBRL, parseMoney } from "@/lib/money";
import { safePhoto } from "@/lib/photo";
import { useStore } from "@/lib/store";
import type { Banner, Goal, Tone } from "@/lib/types";
import { Button, Field, fieldClass, textLink } from "./ui";
import { FormError } from "./motion-bits";
import { ThemeToggle } from "./theme-toggle";

const levels = ["Crítico", "Equilibrado", "Poupador", "Investidor"] as const;

const RESERVE = "goal-reserva";

export function ProfileView() {
  const { state, updateProfile, scope, email, consentAt, role } = useStore();
  const [photoNote, setPhotoNote] = useState("");
  const score = health(state);
  const run = streak(state);
  const reserve = state.goals.find((goal) => goal.id === RESERVE);
  const others = state.goals.filter((goal) => goal.id !== RESERVE);
  const index = (levels as readonly string[]).indexOf(score.level);
  const hasData = score.level !== "Sem dados";
  const photo = safePhoto(state.profile.photoDataUrl);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <div className={`keep-dark relative h-32 rounded-lg border border-line ${bannerClass(state.profile.banner)}`}>
        <div className="absolute bottom-4 left-4 flex items-end gap-3">
          <Avatar name={state.profile.name} photo={photo} />
          <div className="min-w-0">
            <h1 className="text-xl [overflow-wrap:anywhere]">{state.profile.name}</h1>
            {role === "admin" ? <p className="text-xs text-violet-2">Administrador</p> : null}
            <p className="text-sm text-muted">@{state.profile.handle}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section className="blade rounded-lg border border-line bg-surface p-4" aria-labelledby="termometro">
            <h2 id="termometro" className="kicker">
              Termômetro
            </h2>
            <p className="display mt-2 text-4xl">{score.level}</p>
            <div className="mt-4 grid grid-cols-4 gap-1.5" aria-hidden="true">
              {levels.map((level, levelIndex) => (
                <div key={level}>
                  <div className={`h-1.5 rounded-sm ${hasData && levelIndex <= index ? "bg-ink" : "bg-canvas"}`} />
                  <p className="mt-2 truncate text-xs text-faint">{level}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              {hasData ? (
                <>
                  Sequência no azul: <span className="num">{run}</span> {run === 1 ? "mês" : "meses"}.{" "}
                  {reserve && reserve.targetCents > 0
                    ? `A reserva cobre ${Math.round(score.emergency * 100)}% da meta.`
                    : "Defina a meta da reserva abaixo para ver quanto ela cobre."}
                </>
              ) : (
                "Ainda não há dados para medir. Lance a renda e os gastos do mês e o termômetro aparece aqui."
              )}
            </p>
          </section>

          {reserve ? <ReserveEditor goal={reserve} /> : null}

          {others.length > 0 ? (
            <section className="border-t border-line pt-5" aria-labelledby="outras-metas">
              <h2 id="outras-metas" className="text-xl">
                Outras metas
              </h2>
              <ul className="ruled mt-3 border-y border-line">
                {others.map((goal) => (
                  <li key={goal.id} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="min-w-0 [overflow-wrap:anywhere]">{goal.name}</p>
                      <p className="num text-sm text-muted">
                        {formatBRL(goal.savedCents)} de {formatBRL(goal.targetCents)}
                      </p>
                    </div>
                    <Progress goal={goal} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="border-t border-line pt-5" aria-labelledby="patrimonio">
            <h2 id="patrimonio" className="text-xl">
              Patrimônio nas metas
            </h2>
            <p className="num mt-2 text-lg">{state.profile.showPatrimony ? formatBRL(patrimony(state)) : "Oculto nas preferências."}</p>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <form className="grid gap-3" onSubmit={(event) => event.preventDefault()} aria-labelledby="preferencias">
            <h2 id="preferencias" className="text-xl">
              Preferências
            </h2>
            <Field label="Nome">
              <input className={fieldClass} value={state.profile.name} autoComplete="name" onChange={(event) => updateProfile({ name: event.target.value })} />
            </Field>
            <Field label="Usuário">
              <input className={fieldClass} value={state.profile.handle} autoComplete="username" onChange={(event) => updateProfile({ handle: event.target.value.replace(/\s/g, "") })} />
            </Field>
            <Field label="Foto">
              <input
                className={`${fieldClass} py-2`}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  if (!file) return;
                  if (file.size > 300_000 || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
                    setPhotoNote("Use PNG, JPEG, WEBP ou GIF de até 300 KB.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    const next = safePhoto(String(reader.result));
                    if (!next) {
                      setPhotoNote("Essa imagem não pôde ser usada.");
                      return;
                    }
                    setPhotoNote("");
                    updateProfile({ photoDataUrl: next });
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </Field>
            {photoNote ? (
              <FormError>{photoNote}</FormError>
            ) : null}
            {photo ? (
              <Button type="button" tone="ghost" className="justify-self-start" onClick={() => updateProfile({ photoDataUrl: null })}>
                Remover a foto
              </Button>
            ) : null}
            <div className="text-sm text-muted">
              <span className="mb-1.5 block">Tema</span>
              <ThemeToggle />
            </div>
            <Field label="Banner">
              <select className={fieldClass} value={state.profile.banner} onChange={(event) => updateProfile({ banner: event.target.value as Banner })}>
                <option value="violeta">Violeta</option>
                <option value="noite">Noite</option>
                <option value="papel">Papel</option>
              </select>
            </Field>
            <Field label="Tom do agente">
              <select className={fieldClass} value={state.profile.tone} onChange={(event) => updateProfile({ tone: event.target.value as Tone })}>
                <option value="direto">Direto</option>
                <option value="calmo">Calmo</option>
              </select>
            </Field>
            <label className="flex min-h-10 items-center gap-3 text-sm">
              <input type="checkbox" className="size-5" checked={state.profile.showPatrimony} onChange={(event) => updateProfile({ showPatrimony: event.target.checked })} />
              Mostrar a soma das metas
            </label>
            <Link href="/app/resetar" className="tint inline-flex min-h-10 items-center justify-self-start text-sm text-muted hover:text-coral">
              {scope === "demo" ? "Resetar a demonstração" : "Resetar as finanças"}
            </Link>
          </form>
          {scope === "conta" ? <AccountPanel email={email} consentAt={consentAt} role={role} /> : null}
        </div>
      </div>
    </div>
  );
}

function centsToField(cents: number): string {
  if (cents <= 0) return "";
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Progress({ goal }: { goal: Goal }) {
  const share = goalProgress(goal);
  return (
    <div className="mt-2 h-1.5 rounded-full bg-canvas" role="img" aria-label={`${Math.round(share * 100)}% da meta`}>
      <div className="h-1.5 rounded-full bg-mint" style={{ width: `${share * 100}%` }} />
    </div>
  );
}

function ReserveEditor({ goal }: { goal: Goal }) {
  const { updateGoal } = useStore();
  const [name, setName] = useState(goal.name);
  const [target, setTarget] = useState(centsToField(goal.targetCents));
  const [note, setNote] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const share = goalProgress(goal);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cents = parseMoney(target);
    if (!name.trim()) {
      setNote({ kind: "erro", text: "Dê um nome à meta." });
      return;
    }
    if (cents === null || cents <= 0) {
      setNote({ kind: "erro", text: "Escreva um valor maior que zero, como 18.000 ou 18000,00." });
      return;
    }
    updateGoal(goal.id, { name, targetCents: cents });
    setName(name.trim());
    setTarget(centsToField(cents));
    setNote({ kind: "ok", text: "Meta salva." });
  };

  return (
    <section className="border-t border-line pt-5" aria-labelledby="meta-reserva">
      <h2 id="meta-reserva" className="text-xl">
        Meta da reserva
      </h2>
      <p className="mt-2 text-lg [overflow-wrap:anywhere]">{goal.name}</p>
      <p className="num mt-1 text-muted">
        {formatBRL(goal.savedCents)} de {formatBRL(goal.targetCents)}
        {goal.targetCents > 0 ? `, ${Math.round(share * 100)}%` : ""}
      </p>
      {goal.targetCents > 0 ? (
        <Progress goal={goal} />
      ) : (
        <p className="sheet-grid mt-3 rounded-lg border border-line px-3 py-2 text-sm leading-relaxed text-muted">
          A meta ainda está em zero. Escreva abaixo quanto você quer ter guardado, por exemplo o essencial de seis meses. O agente e o termômetro passam a usar esse valor.
        </p>
      )}
      {goal.note && goal.targetCents > 0 ? <p className="mt-3 text-sm leading-relaxed text-muted">{goal.note}</p> : null}
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
        <Field label="Nome da meta">
          <input className={fieldClass} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Meta em R$">
          <input className={fieldClass} inputMode="decimal" value={target} placeholder="18.000,00" onChange={(event) => setTarget(event.target.value)} />
        </Field>
        <Button type="submit">Salvar meta</Button>
      </form>
      {note ? (
        <p className={`mt-3 text-sm ${note.kind === "erro" ? "text-coral" : "text-mint"}`} role={note.kind === "erro" ? "alert" : "status"}>
          {note.text}
        </p>
      ) : null}
    </section>
  );
}

function AccountPanel({
  email,
  consentAt,
  role,
}: {
  email: string | null;
  consentAt: string | null;
  role: "admin" | "user" | null;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [erase, setErase] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const when = consentAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date(consentAt))
    : null;

  const leaveEverywhere = async () => {
    setNote(null);
    setLeaving(true);
    const response = await fetch("/api/auth/logout-all", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }).catch(() => null);
    const body = (await response?.json().catch(() => null)) as { error?: string } | null;
    setLeaving(false);
    if (response?.ok) {
      router.push("/entrar");
      return;
    }
    setNote({ kind: "erro", text: response ? (body?.error ?? "Não foi possível sair dos outros aparelhos. Tente de novo.") : "Sem conexão. Tente de novo." });
  };

  return (
    <section className="ruled border-t border-line pt-5" aria-labelledby="conta-lgpd">
      <div className="pb-4">
        <h2 id="conta-lgpd" className="text-xl">
          Conta e LGPD
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <span className="[overflow-wrap:anywhere]">{email}</span>. {role === "admin" ? "Esta conta é a administradora. " : ""}
          Consentimento registrado {when ?? "nesta conta"}, versão dos termos 2026-11-15. A planilha no banco está cifrada com a sua senha.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-5">
          {role === "admin" ? (
            <Link className={textLink} href="/app/admin">
              Administração
            </Link>
          ) : null}
          <a className={textLink} href="/api/account/export">
            Exportar meus dados
          </a>
          <Link className={textLink} href="/privacidade">
            Aviso de privacidade
          </Link>
          <Link className={textLink} href="/termos">
            Termos
          </Link>
        </div>
      </div>
      <div className="grid gap-3 py-4">
        <h3 className="text-base">Sessões</h3>
        <p className="text-sm text-muted">Encerra o login neste e em todos os outros aparelhos. Útil se você entrou em um computador que não é seu.</p>
        <Button type="button" tone="ghost" className="justify-self-start" disabled={leaving} onClick={() => void leaveEverywhere()}>
          {leaving ? "Saindo…" : "Sair de todos os aparelhos"}
        </Button>
      </div>
      <form
        className="grid gap-3 py-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setNote(null);
          const response = await fetch("/api/account/password", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ current, next }),
          }).catch(() => null);
          const body = (await response?.json().catch(() => null)) as { error?: string } | null;
          if (response?.ok) {
            setNote({ kind: "ok", text: "Senha trocada. A chave da planilha foi reembrulhada." });
            setCurrent("");
            setNext("");
          } else setNote({ kind: "erro", text: response ? (body?.error ?? "Não trocou a senha.") : "Sem conexão. Tente de novo." });
        }}
      >
        <h3 className="text-base">Trocar senha</h3>
        <Field label="Senha atual">
          <input className={fieldClass} type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} />
        </Field>
        <Field label="Nova senha, mínimo 10 caracteres">
          <input className={fieldClass} type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} />
        </Field>
        <Button type="submit" tone="ghost" className="justify-self-start">
          Trocar senha
        </Button>
      </form>
      <form
        className="grid gap-3 pt-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setNote(null);
          const response = await fetch("/api/account/delete", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ password: erase }),
          }).catch(() => null);
          const body = (await response?.json().catch(() => null)) as { error?: string } | null;
          if (response?.ok) {
            router.push("/");
            router.refresh();
          } else setNote({ kind: "erro", text: response ? (body?.error ?? "Não apagou a conta.") : "Sem conexão. Tente de novo." });
        }}
      >
        <h3 className="text-base">Apagar a conta e a planilha</h3>
        <p className="text-sm text-muted">Isso não pode ser desfeito. Exporte os dados antes, se quiser guardar uma cópia.</p>
        <Field label="Senha para confirmar">
          <input className={fieldClass} type="password" autoComplete="current-password" value={erase} onChange={(event) => setErase(event.target.value)} />
        </Field>
        <Button type="submit" tone="ghost" className="justify-self-start text-coral hover:border-coral">
          Excluir meus dados
        </Button>
      </form>
      {note ? (
        <p className={`pt-4 text-sm ${note.kind === "erro" ? "text-coral" : "text-mint"}`} role={note.kind === "erro" ? "alert" : "status"}>
          {note.text}
        </p>
      ) : null}
    </section>
  );
}

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  if (photo) {
    return (
      // The source is a validated data URL. The image optimizer does not accept it.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt="" className="size-16 rounded-full object-cover" />
    );
  }
  return (
    <span className="flex size-16 items-center justify-center rounded-full bg-canvas text-lg">{initials}</span>
  );
}

function bannerClass(banner: Banner): string {
  if (banner === "noite") return "bg-[#16141f]";
  if (banner === "papel") return "bg-[#2a2433]";
  return "bg-[#241d38]";
}
