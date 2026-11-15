"use client";

import { health, patrimony, streak } from "@/lib/finance";
import { formatBRL } from "@/lib/money";
import { useStore } from "@/lib/store";
import type { Banner, Tone } from "@/lib/types";
import { AppFrame } from "./app-frame";
import { fieldClass } from "./ui";

const levels = ["Crítico", "Equilibrado", "Poupador", "Investidor"] as const;

export function ProfileView() {
  const { state, updateProfile, reset } = useStore();
  const score = health(state);
  const run = streak(state);
  const goal = state.goals[0];
  const index = levels.indexOf(score.level);

  return (
    <AppFrame>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
        <div className={`relative h-40 overflow-hidden rounded-3xl border border-line ${bannerClass(state.profile.banner)}`}>
          <div className="absolute bottom-4 left-4 flex items-end gap-3">
            <Avatar name={state.profile.name} photo={state.profile.photoDataUrl} />
            <div>
              <p className="text-xl">{state.profile.name}</p>
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
                style={{ width: `${Math.min(100, (goal.savedCents / goal.targetCents) * 100)}%` }}
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
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => updateProfile({ photoDataUrl: String(reader.result) });
                reader.readAsDataURL(file);
              }}
            />
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
          <button type="button" className="justify-self-start text-sm text-faint hover:text-coral" onClick={() => reset()}>
            Restaurar o exemplo da Marina
          </button>
        </form>
      </div>
    </AppFrame>
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
      <span
        role="img"
        aria-label={`Foto de ${name}`}
        className="size-16 rounded-full bg-cover bg-center"
        style={{ backgroundImage: `url(${photo})` }}
      />
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
