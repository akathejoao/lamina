"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { SliceChart } from "./slice-chart";
import { SheetForm } from "./sheet-form";
import { currentMonthly, health, mathFor, sheetHeadline, streak, tips } from "@/lib/finance";
import { formatBRL, formatMonth, monthKey, todayISO } from "@/lib/money";
import { easeOut } from "@/lib/motion";
import { accentOf, ACCENT_COLOR } from "@/lib/sheets";
import { useStore } from "@/lib/store";
import { KIND_LABEL } from "@/lib/types";
import { SidePortal } from "./app-frame";
import { Button, Modal } from "./ui";

// Atrasos não uniformes, curtos: a lista aparece em cascata sem segurar o toque.
const stagger = [0, 0.04, 0.09, 0.13, 0.18, 0.22, 0.26];

export function HomeView() {
  const { state, createSheet } = useStore();
  const router = useRouter();
  const reduce = useReducedMotion();
  const now = todayISO();
  const active = state.sheets.filter((sheet) => !sheet.archived);
  const archived = state.sheets.filter((sheet) => sheet.archived);
  const current = currentMonthly(state, now);
  const numbers = current ? mathFor(state, current, now) : null;
  const score = health(state, now);
  const run = streak(state, now);
  // As dicas e os vencimentos vêm do ciclo do mês; sem ciclo, da primeira planilha aberta.
  const base = current ?? active[0] ?? null;
  const advice = base ? tips(state, base, now).slice(0, 2) : [];
  const dues = numbers?.dues ?? [];
  const hasData = score.level !== "Sem dados";
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  return (
    <>
      <SidePortal>
        <aside className="h-full space-y-5 p-4" aria-label="Resumo do mês">
          <section aria-labelledby="este-mes">
            <h2 id="este-mes" className="kicker">
              Este mês
            </h2>
            {numbers ? (
              <>
                <p className={`num mt-1 text-3xl [overflow-wrap:anywhere] ${numbers.free < 0 ? "text-coral" : ""}`}>{formatBRL(numbers.free)}</p>
                <p className="text-sm text-muted">livre em {current?.name}</p>
              </>
            ) : (
              <p className="sheet-grid mt-2 rounded-lg border border-line px-3 py-3 text-sm leading-relaxed text-muted">
                Nenhum ciclo mensal aberto. Crie uma planilha de mês em Nova planilha para ver o livre e as fatias aqui.
              </p>
            )}
          </section>
          {numbers ? (
            <div className="border-t border-line pt-5">
              <SliceChart essenciais={numbers.essenciais} estilo={numbers.estilo} futuro={numbers.futuro} />
            </div>
          ) : null}
          <section className="border-t border-line pt-5" aria-labelledby="saude">
            <h2 id="saude" className="kicker">
              Saúde
            </h2>
            <p className="mt-1 text-lg">{score.level}</p>
            <p className="text-sm text-muted">{hasData ? `${run} ${run === 1 ? "mês" : "meses"} no azul` : "Lance a renda e os gastos do mês para medir."}</p>
          </section>
        </aside>
      </SidePortal>
      <div className="@container mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="kicker">Olá, {state.profile.name.split(" ")[0]}</p>
            <h1 className="display mt-1.5 text-4xl sm:text-5xl">Suas planilhas</h1>
          </div>
          <Button type="button" onClick={() => setOpen(true)}>
            Nova planilha
          </Button>
        </div>

        <div className="blade mt-6 rounded-lg border border-line bg-surface">
          <div className="col-label hidden grid-cols-[minmax(0,1fr)_7rem_11rem] gap-x-4 border-b border-line px-4 py-2 uppercase @lg:grid">
            <span>Planilha</span>
            <span>Tipo</span>
            <span className="text-right">Resultado</span>
          </div>
          {active.length === 0 ? (
            <div className="sheet-grid px-4 py-10 text-center">
              <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted">Nenhuma planilha aberta. Use Nova planilha para começar o mês, uma meta ou a reserva.</p>
            </div>
          ) : (
            <ul className="ruled">
              {active.map((sheet, index) => {
                const headline = sheetHeadline(state, sheet, now);
                return (
                  <motion.li
                    key={sheet.id}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduce ? 0 : 0.22, delay: reduce ? 0 : (stagger[Math.min(index, stagger.length - 1)] ?? 0.26), ease: easeOut }}
                  >
                    <Link
                      href={`/app/planilha/${sheet.id}`}
                      className="tint grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 px-4 py-3 hover:bg-surface-2/50 @lg:grid-cols-[minmax(0,1fr)_7rem_11rem]"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-lg">
                          <span className="size-2 shrink-0 rounded-full" style={{ background: ACCENT_COLOR[accentOf(sheet)] }} aria-hidden="true" />
                          <span className="min-w-0 [overflow-wrap:anywhere]">{sheet.name}</span>
                        </span>
                        <span className="mt-0.5 block text-sm text-muted">
                          <span className="@lg:hidden">{KIND_LABEL[sheet.kind]}, </span>
                          {sheet.note
                            ? sheet.note
                            : sheet.month
                              ? formatMonth(sheet.month)
                              : sheet.deadline
                                ? `até ${sheet.deadline.split("-").reverse().join("/")}`
                                : "acompanhamento contínuo"}
                        </span>
                      </span>
                      <span className="kicker hidden @lg:block">{KIND_LABEL[sheet.kind]}</span>
                      <span className="min-w-0 text-right">
                        <span className={`num block text-lg [overflow-wrap:anywhere] ${headline.cents < 0 ? "text-coral" : ""}`}>{formatBRL(headline.cents)}</span>
                        <span className="kicker block">{headline.label}</span>
                      </span>
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>

        {archived.length ? (
          <button type="button" className="tint mt-3 inline-flex min-h-10 items-center text-sm text-muted hover:text-ink" aria-expanded={showArchived} onClick={() => setShowArchived((value) => !value)}>
            {showArchived ? "Esconder arquivadas" : `Ver ${archived.length} arquivadas`}
          </button>
        ) : null}
        {showArchived ? (
          <ul className="ruled border-y border-line">
            {archived.map((sheet) => (
              <li key={sheet.id}>
                <Link href={`/app/planilha/${sheet.id}`} className="inline-flex min-h-10 w-full items-center text-sm text-muted hover:text-ink">
                  {sheet.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {base ? (
          <div className="mt-8 grid gap-x-10 gap-y-8 border-t border-line pt-6 @2xl:grid-cols-[1.4fr_1fr]">
            <section aria-labelledby="dicas-home">
              <h2 id="dicas-home" className="text-xl">
                Dicas
              </h2>
              <ul className="ruled mt-3 border-y border-line">
                {advice.map((tip, index) => (
                  <li key={tip} className="flex gap-3 py-3 text-sm leading-relaxed">
                    <span className="num mt-0.5 shrink-0 text-xs text-faint">{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0">{tip}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">Calculadas com os números de {base.name}. Há mais no painel do agente, na aba Dicas.</p>
            </section>
            <section aria-labelledby="vencimentos-home">
              <h2 id="vencimentos-home" className="text-xl">
                Próximos vencimentos
              </h2>
              {dues.length === 0 ? (
                <p className="sheet-grid mt-3 rounded-lg border border-line px-4 py-3 text-sm leading-relaxed text-muted">
                  Nada vence nos próximos 7 dias. Lance uma conta com o dia de vencimento e ela aparece aqui.
                </p>
              ) : (
                <ul className="ruled mt-3 border-y border-line">
                  {dues.map(({ entry, distance }) => (
                    <li key={entry.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block [overflow-wrap:anywhere]">{entry.title}</span>
                        <span className="text-muted">{distance === 0 ? "hoje" : distance === 1 ? "amanhã" : `em ${distance} dias`}</span>
                      </span>
                      <span className="num shrink-0">{formatBRL(entry.cents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
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
