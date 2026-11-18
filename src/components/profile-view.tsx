"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { health, patrimony, streak } from "@/lib/finance";
import { formatBRL } from "@/lib/money";
import { safePhoto } from "@/lib/photo";
import { useStore } from "@/lib/store";
import type { Banner, Tone } from "@/lib/types";
import { Button, fieldClass } from "./ui";

const levels = ["Crítico", "Equilibrado", "Poupador", "Investidor"] as const;

export function ProfileView() {
  const { state, updateProfile, scope, email, consentAt, role } = useStore();
  const [photoNote, setPhotoNote] = useState("");
  const score = health(state);
  const run = streak(state);
  const goal = state.goals[0];
  const index = levels.indexOf(score.level);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
        <div className={`relative h-40 overflow-hidden rounded-3xl border border-line ${bannerClass(state.profile.banner)}`}>
          <div className="absolute bottom-4 left-4 flex items-end gap-3">
            <Avatar name={state.profile.name} photo={safePhoto(state.profile.photoDataUrl)} />
            <div>
              <p className="text-xl">{state.profile.name}</p>
              {role === "admin" ? <p className="text-xs text-violet-2">Administrador</p> : null}
              <p className="text-sm text-muted">@{state.profile.handle}</p>
            </div>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-line bg-surface p-4">
          <p className="kicker">Termômetro</p>
          <p className="display mt-2 text-4xl">{score.level}</p>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {levels.map((level, levelIndex) => (
              <div key={level}>
                <div className={`h-2 rounded-full ${levelIndex <= index ? "bg-violet" : "bg-canvas"}`} />
                <p className="mt-2 text-xs text-faint">{level}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">
            Sequência no azul: {run} {run === 1 ? "mês" : "meses"}. A reserva cobre {Math.round(score.emergency * 100)}% da meta.
          </p>
        </section>

        {goal ? (
          <section className="mt-4 rounded-2xl border border-line p-4">
            <p className="kicker">Meta atual</p>
            <p className="mt-2 text-xl">{goal.name}</p>
            <p className="num mt-1 text-muted">
              {formatBRL(goal.savedCents)} de {formatBRL(goal.targetCents)}
            </p>
            <div className="mt-3 h-2 rounded-full bg-canvas">
              <div
                className="h-2 rounded-full bg-mint"
                style={{ width: `${goal.targetCents > 0 ? Math.min(100, (goal.savedCents / goal.targetCents) * 100) : 0}%` }}
              />
            </div>
          </section>
        ) : null}

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-line p-4">
            <p className="kicker">Conquista</p>
            <p className="mt-2 text-sm">Três ciclos mensais fechados no azul, de setembro a novembro.</p>
          </article>
          <article className="rounded-2xl border border-line p-4">
            <p className="kicker">Conquista</p>
            <p className="mt-2 text-sm">Reserva passou de um terço do alvo sem mexer no lazer inteiro.</p>
          </article>
          <article className="rounded-2xl border border-line p-4">
            <p className="kicker">Patrimônio nas metas</p>
            <p className="num mt-2 text-lg">{state.profile.showPatrimony ? formatBRL(patrimony(state)) : "oculto"}</p>
          </article>
        </section>

        <form
          className="mt-6 grid gap-3 rounded-2xl border border-line p-4"
          onSubmit={(event) => event.preventDefault()}
        >
          <p className="kicker">Preferências</p>
          <label className="text-sm text-muted">
            Nome
            <input className={`${fieldClass} mt-1`} value={state.profile.name} onChange={(event) => updateProfile({ name: event.target.value })} />
          </label>
          <label className="text-sm text-muted">
            Usuário
            <input className={`${fieldClass} mt-1`} value={state.profile.handle} onChange={(event) => updateProfile({ handle: event.target.value.replace(/\s/g, "") })} />
          </label>
          <label className="text-sm text-muted">
            Foto
            <input
              className={`${fieldClass} mt-1`}
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
                  const photo = safePhoto(String(reader.result));
                  if (!photo) {
                    setPhotoNote("Essa imagem não pôde ser usada.");
                    return;
                  }
                  setPhotoNote("");
                  updateProfile({ photoDataUrl: photo });
                };
                reader.readAsDataURL(file);
              }}
            />
            {photoNote ? <p className="text-sm text-muted">{photoNote}</p> : null}
          </label>
          <label className="text-sm text-muted">
            Banner
            <select
              className={`${fieldClass} mt-1`}
              value={state.profile.banner}
              onChange={(event) => updateProfile({ banner: event.target.value as Banner })}
            >
              <option value="violeta">Violeta</option>
              <option value="noite">Noite</option>
              <option value="papel">Papel</option>
            </select>
          </label>
          <label className="text-sm text-muted">
            Tom do agente
            <select
              className={`${fieldClass} mt-1`}
              value={state.profile.tone}
              onChange={(event) => updateProfile({ tone: event.target.value as Tone })}
            >
              <option value="direto">Direto</option>
              <option value="calmo">Calmo</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.profile.showPatrimony}
              onChange={(event) => updateProfile({ showPatrimony: event.target.checked })}
            />
            Mostrar a soma das metas
          </label>
          <a href="/app/resetar" className="justify-self-start text-sm text-faint hover:text-coral">
            {scope === "demo" ? "Resetar a demonstração" : "Resetar as finanças"}
          </a>
        </form>
        {scope === "conta" ? <AccountPanel email={email} consentAt={consentAt} role={role} /> : null}
      </div>
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
  const [note, setNote] = useState<string | null>(null);
  const when = consentAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date(consentAt))
    : null;

  return (
    <section className="mt-4 rounded-2xl border border-line p-4">
      <p className="kicker">Conta e LGPD</p>
      <p className="mt-2 text-sm text-muted">
        {email}. {role === "admin" ? "Esta conta é a administradora. " : ""}
        Consentimento registrado {when ?? "nesta conta"}, versão dos termos 2026-11-15. A planilha no banco está cifrada com a sua senha.
      </p>
      {role === "admin" ? (
        <a className="mt-3 inline-flex text-sm text-violet-2" href="/app/admin">
          Administração
        </a>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <a className="text-violet-2" href="/api/account/export">
          Exportar meus dados
        </a>
        <a className="text-violet-2" href="/privacidade">
          Aviso de privacidade
        </a>
        <a className="text-violet-2" href="/termos">
          Termos
        </a>
      </div>
      <form
        className="mt-4 grid gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const response = await fetch("/api/account/password", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ current, next }),
          });
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          setNote(response.ok ? "Senha trocada. A chave da planilha foi reembrulhada." : (body?.error ?? "Não trocou a senha."));
          if (response.ok) {
            setCurrent("");
            setNext("");
          }
        }}
      >
        <p className="text-sm">Trocar senha</p>
        <input className={fieldClass} type="password" autoComplete="current-password" placeholder="Senha atual" value={current} onChange={(event) => setCurrent(event.target.value)} />
        <input className={fieldClass} type="password" autoComplete="new-password" placeholder="Nova senha, mínimo 10" value={next} onChange={(event) => setNext(event.target.value)} />
        <Button type="submit" tone="ghost">
          Trocar senha
        </Button>
      </form>
      <form
        className="mt-4 grid gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const response = await fetch("/api/account/delete", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ password: erase }),
          });
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          if (response.ok) {
            router.push("/");
            router.refresh();
          }
          else setNote(body?.error ?? "Não apagou a conta.");
        }}
      >
        <p className="text-sm">Apagar a conta e a planilha</p>
        <input className={fieldClass} type="password" autoComplete="current-password" placeholder="Senha para confirmar" value={erase} onChange={(event) => setErase(event.target.value)} />
        <Button type="submit" tone="ghost">
          Excluir meus dados
        </Button>
      </form>
      {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
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
  return "bg-[linear-gradient(120deg,#2a2144_0%,#14121c_55%,#3a2158_100%)]";
}
