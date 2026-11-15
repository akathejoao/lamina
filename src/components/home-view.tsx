"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SliceChart } from "./slice-chart";
import { SheetForm } from "./sheet-form";
import { currentMonthly, health, mathFor, streak, tips } from "@/lib/finance";
import { formatBRL, formatMonth, monthKey, todayISO } from "@/lib/money";
import { accentOf, ACCENT_COLOR } from "@/lib/sheets";
import { useStore } from "@/lib/store";
import { KIND_LABEL } from "@/lib/types";
import { SidePortal } from "./app-frame";
import { Button, Modal } from "./ui";

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
    <>
      <SidePortal>
        <aside className="h-full space-y-4 p-4">
          <p className="kicker">Este mês</p>
          <p className="num text-3xl">{numbers ? formatBRL(numbers.free) : "—"}</p>
          <p className="text-sm text-muted">livre em {current?.name ?? "nenhum ciclo aberto"}</p>
          {numbers ? <SliceChart essenciais={numbers.essenciais} estilo={numbers.estilo} futuro={numbers.futuro} /> : null}
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
      </SidePortal>
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
                <Link href={`/app/planilha/${sheet.id}`} className="tint relative block overflow-hidden rounded-2xl border border-line bg-surface px-4 py-4 pl-5 hover:border-violet-2">
                  <span className="absolute inset-y-3 left-0 w-1 rounded-full" style={{ background: ACCENT_COLOR[accentOf(sheet)] }} />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="kicker">{KIND_LABEL[sheet.kind]}</p>
                      <p className="mt-1 text-xl">{sheet.name}</p>
                      <p className="mt-1 text-sm text-muted">
                        {sheet.note
                          ? sheet.note
                          : sheet.month
                            ? formatMonth(sheet.month)
                            : sheet.deadline
                              ? `até ${sheet.deadline.split("-").reverse().join("/")}`
                              : "acompanhamento contínuo"}
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
      <Modal open={open} title="Nova planilha" onClose={() => setOpen(false)} wide>
        <SheetForm
          mode="create"
          defaultMonth={monthKey(now)}
          onSubmit={(draft) => {
            const id = createSheet(draft);
            setOpen(false);
            router.push(`/app/planilha/${id}`);
          }}
        />
      </Modal>
    </>
  );
}
