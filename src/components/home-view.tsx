"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { currentMonthly, health, mathFor, streak, tips } from "@/lib/finance";
import { formatBRL, formatMonth, monthKey, parseMoney, todayISO } from "@/lib/money";
import { useStore } from "@/lib/store";
import { KIND_LABEL, type SheetKind } from "@/lib/types";
import { AppFrame } from "./app-frame";
import { Button, Field, Modal, fieldClass } from "./ui";

export function HomeView() {
  const { state, createSheet } = useStore();
  const router = useRouter();
  const now = todayISO();
  const active = state.sheets.filter((sheet) => !sheet.archived);
  const archived = state.sheets.filter((sheet) => sheet.archived);
  const current = currentMonthly(state, now);
  const numbers = current ? mathFor(state, current, now) : null;
  const score = health(state, now);
  const run = streak(state, now);
  const advice = current ? tips(state, current, now)[0] : null;
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  return (
    <AppFrame
      side={
        <aside className="h-full space-y-4 p-4">
          <p className="kicker">Este mês</p>
          <p className="num text-3xl">{numbers ? formatBRL(numbers.free) : "—"}</p>
          <p className="text-sm text-muted">livre em {current?.name ?? "nenhum ciclo aberto"}</p>
          <div className="rounded-2xl border border-line bg-surface p-3">
            <p className="kicker">Saúde</p>
            <p className="mt-2 text-lg">{score.level}</p>
            <p className="text-sm text-muted">{run} {run === 1 ? "mês" : "meses"} no azul</p>
          </div>
          <div>
            <p className="kicker">Vence em breve</p>
            <ul className="mt-3 space-y-2">
              {(numbers?.dues ?? []).length === 0 ? <li className="text-sm text-muted">Nada nos próximos 7 dias.</li> : null}
              {numbers?.dues.map(({ entry, distance }) => (
                <li key={entry.id} className="rounded-xl border border-line px-3 py-2 text-sm">
                  <span className="block">{entry.title}</span>
                  <span className="text-muted">{distance === 0 ? "hoje" : `em ${distance} dias`} · {formatBRL(entry.cents)}</span>
                </li>
              ))}
            </ul>
          </div>
          {advice ? (
            <div className="rounded-2xl border border-line bg-surface p-3">
              <p className="kicker">Dica do dia</p>
              <p className="mt-2 text-sm leading-relaxed">{advice}</p>
            </div>
          ) : null}
        </aside>
      }
    >
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
        <p className="kicker">Olá, {state.profile.name.split(" ")[0]}</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1 className="display text-4xl sm:text-5xl">Suas planilhas</h1>
          <Button type="button" onClick={() => setOpen(true)}>
            Nova planilha
          </Button>
        </div>
        <ul className="mt-8 space-y-3">
          {active.map((sheet) => {
            const math = mathFor(state, sheet, now);
            const goal = state.goals.find((item) =>
              sheet.id === "sheet-reserva" ? item.id === "goal-reserva" : sheet.id === "sheet-jp" ? item.id === "goal-jp" : false,
            );
            const shown = sheet.kind === "mensal" ? math.free : (goal?.savedCents ?? math.invested);
            return (
              <li key={sheet.id}>
                <Link href={`/app/planilha/${sheet.id}`} className="block rounded-2xl border border-line bg-surface px-4 py-4 hover:border-violet-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="kicker">{KIND_LABEL[sheet.kind]}</p>
                      <p className="mt-1 text-xl">{sheet.name}</p>
                      <p className="mt-1 text-sm text-muted">
                        {sheet.month ? formatMonth(sheet.month) : sheet.deadline ? `até ${sheet.deadline.split("-").reverse().join("/")}` : "acompanhamento contínuo"}
                      </p>
                    </div>
                    <p className="num text-right text-lg">{formatBRL(shown)}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        {archived.length ? (
          <button type="button" className="mt-6 text-sm text-muted" onClick={() => setShowArchived((value) => !value)}>
            {showArchived ? "Esconder arquivadas" : `Ver ${archived.length} arquivadas`}
          </button>
        ) : null}
        {showArchived ? (
          <ul className="mt-3 space-y-2">
            {archived.map((sheet) => (
              <li key={sheet.id}>
                <Link href={`/app/planilha/${sheet.id}`} className="text-sm text-faint hover:text-ink">
                  {sheet.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <NewSheet
        open={open}
        onClose={() => setOpen(false)}
        onCreate={(draft) => {
          const id = createSheet(draft);
          setOpen(false);
          router.push(`/app/planilha/${id}`);
        }}
        defaultMonth={monthKey(now)}
      />
    </AppFrame>
  );
}

function NewSheet({
  open,
  onClose,
  onCreate,
  defaultMonth,
}: {
  open: boolean;
  onClose: () => void;
  defaultMonth: string;
  onCreate: (draft: {
    name: string;
    kind: SheetKind;
    month: string | null;
    deadline: string | null;
    targetCents: number | null;
  }) => void;
}) {
  const [kind, setKind] = useState<SheetKind>("mensal");
  const [name, setName] = useState("");
  const [month, setMonth] = useState(defaultMonth);
  const [deadline, setDeadline] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Dê um nome que você reconheça daqui a um mês.");
      return;
    }
    const targetCents = target ? parseMoney(target) : null;
    onCreate({
      name: name.trim(),
      kind,
      month: kind === "mensal" ? month : null,
      deadline: kind === "meta" ? deadline || null : null,
      targetCents: kind === "mensal" ? null : targetCents,
    });
    setName("");
    setError(null);
  };

  return (
    <Modal open={open} title="Nova planilha" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        <Field label="Tipo">
          <select className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value as SheetKind)}>
            <option value="mensal">Ciclo mensal — fecha ao virar o mês</option>
            <option value="meta">Meta com prazo</option>
            <option value="continuo">Visão contínua / patrimônio</option>
          </select>
        </Field>
        <Field label="Nome">
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Novembro, Japão, Reserva" />
        </Field>
        {kind === "mensal" ? (
          <Field label="Mês">
            <input className={fieldClass} type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </Field>
        ) : null}
        {kind === "meta" ? (
          <Field label="Prazo">
            <input className={fieldClass} type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </Field>
        ) : null}
        {kind !== "mensal" ? (
          <Field label="Valor da meta">
            <input className={fieldClass} value={target} onChange={(event) => setTarget(event.target.value)} placeholder="18000" />
          </Field>
        ) : null}
        {error ? <p className="text-sm text-coral">{error}</p> : null}
        <div className="flex justify-end">
          <Button type="submit">Criar</Button>
        </div>
      </form>
    </Modal>
  );
}
