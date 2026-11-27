"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { interpret } from "@/lib/agent";
import { mathFor } from "@/lib/finance";
import { trails } from "@/lib/learn";
import { formatBRL, formatDay, formatMonth, todayISO } from "@/lib/money";
import { SLICE_COLOR, splitOf } from "@/lib/sheets";
import { NOVEMBER, useStore } from "@/lib/store";
import { ENTRY_LABEL } from "@/lib/types";
import { AgentPanel } from "./agent-panel";
import { Mark } from "./mark";
import { Reveal, Rolling } from "./motion-bits";
import { SheetStage, Split } from "./sheet-stage";

// O que o agente entende, lido por ele mesmo sobre o exemplo: frases de lançamento viram linha, perguntas viram resposta.
const PHRASES = [
  "Gastei R$ 85 no mercado hoje",
  "vale alimentação de 350 reais",
  "Recebi R$ 400 de freelance",
  "Netflix é 55,90",
  "quanto gastei esse mês?",
  "qual meu saldo?",
];

const COUNT_WORD = ["Nenhuma", "Uma", "Duas", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove", "Dez"];

const primary = "press inline-flex min-h-11 items-center justify-center rounded-md bg-violet px-5 text-sm font-medium text-ink hover:bg-[#5d3de0]";
const secondary = "press inline-flex min-h-11 items-center justify-center rounded-md border border-line px-5 text-sm font-medium text-ink hover:border-violet-2 hover:bg-surface-2";
const navLink = "tint inline-flex min-h-10 items-center rounded-md px-3 hover:text-ink";
const headline = "display text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[0.95]";

export function Landing() {
  const { state } = useStore();
  const sheet = state.sheets.find((item) => item.id === NOVEMBER);
  const numbers = sheet ? mathFor(state, sheet) : null;
  const split = sheet ? splitOf(sheet) : null;
  const base = numbers ? (numbers.income > 0 ? numbers.income : numbers.essenciais + numbers.estilo + numbers.futuro) : 0;
  const latest = sheet
    ? state.entries
        .filter((entry) => entry.sheetId === sheet.id)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6)
    : [];

  return (
    <div className="relative">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5">
          <Link href="/" className="display flex min-h-10 items-center gap-2 text-xl">
            <Mark className="size-7" />
            Lâmina
          </Link>
          <nav className="hidden items-center gap-1 text-sm text-muted md:flex" aria-label="Seções">
            <a className={navLink} href="#ciclos">Ciclos</a>
            <a className={navLink} href="#agente">Agente</a>
            <a className={navLink} href="#divisao">Divisão</a>
            <a className={navLink} href="#aprender">Aprender</a>
            <Link className={navLink} href="/baixar">Baixar</Link>
          </nav>
          <div className="flex items-center gap-1">
            <Link href="/entrar" className="tint inline-flex min-h-10 items-center rounded-md px-3 text-sm text-muted hover:text-ink">
              Entrar
            </Link>
            <Link href="/criar-conta" className="press inline-flex min-h-10 items-center rounded-md bg-violet px-4 text-sm font-medium text-ink hover:bg-[#5d3de0]">
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="sheet-grid sheet-grid-fade pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl items-end gap-10 px-4 pt-12 pb-14 md:grid-cols-[1.3fr_0.7fr] md:pt-20 md:pb-16">
            <div>
              <p className="hero-in col-label" aria-hidden="true">01&nbsp;&nbsp;PLANILHA + AGENTE</p>
              <h1 className="hero-in display mt-4 text-[clamp(3rem,7.4vw,6rem)] leading-[0.92]" style={{ animationDelay: "50ms" }}>O mês inteiro numa tela só.</h1>
              <p className="hero-in mt-6 max-w-lg text-lg leading-relaxed text-muted" style={{ animationDelay: "110ms" }}>
                Escreva o gasto como fala. O agente lança na planilha e mostra quanto ainda cabe no mês.
              </p>
              <div className="hero-in mt-8 flex flex-wrap gap-3" style={{ animationDelay: "170ms" }}>
                <Link href="/criar-conta" className={primary}>
                  Criar conta
                </Link>
                <Link href="/entrar" className={secondary}>
                  Entrar
                </Link>
              </div>
            </div>
            <aside className="hero-in blade rounded-lg border border-line bg-surface" style={{ animationDelay: "140ms" }} aria-label="Resumo do exemplo">
              <table className="w-full text-sm">
                <caption className="sr-only">{sheet?.month ? `${formatMonth(sheet.month)}, em números` : "O mês em números"}</caption>
                <thead>
                  <tr className="col-label border-b border-line text-left">
                    <th scope="col" className="w-9 px-3 py-2.5 font-normal" aria-hidden="true" />
                    <th scope="col" className="py-2.5 font-normal whitespace-nowrap">
                      <span aria-hidden="true">A&nbsp;&nbsp;</span>
                      {sheet?.month ? formatMonth(sheet.month).toUpperCase().replace(" DE ", "/") : "MÊS"}
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-normal">
                      <span aria-hidden="true">B&nbsp;&nbsp;</span>VALOR
                    </th>
                  </tr>
                </thead>
                <tbody className="[&>tr+tr]:border-t [&>tr+tr]:border-line">
                  <LedgerRow n={1} k="Entradas" v={numbers ? <Rolling cents={numbers.income} /> : "sem dados"} tone="text-mint" />
                  <LedgerRow n={2} k="Saídas" v={numbers ? <Rolling cents={numbers.burn} /> : "sem dados"} tone="text-coral" />
                  <LedgerRow n={3} k="Guardado" v={numbers ? <Rolling cents={numbers.invested} /> : "sem dados"} />
                  <LedgerRow n={4} k="Livre" v={numbers ? <Rolling cents={numbers.free} /> : "sem dados"} total />
                  <LedgerRow n={5} k="Por dia" v={numbers ? <Rolling cents={numbers.daily} /> : "sem dados"} />
                </tbody>
              </table>
              <p className="border-t border-line px-3 py-3 text-xs leading-relaxed text-muted">
                Muda quando você mexe na planilha abaixo. Hoje é {todayISO().split("-").reverse().join("/")}.
              </p>
            </aside>
          </div>
        </section>

        <section id="palco" className="border-t border-line">
          <Reveal className="mx-auto max-w-6xl px-4 pt-10 pb-20">
            <div className="overflow-hidden rounded-lg border border-line bg-canvas">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-1.5">
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <Mark className="size-5 shrink-0" />
                  <span className="col-label hidden sm:inline" aria-hidden="true">fx</span>
                  <span className="truncate">Exemplo: {sheet?.name}</span>
                </div>
                <Link href="/demo" className="tint inline-flex min-h-10 shrink-0 items-center text-sm text-violet-2 hover:text-ink">
                  Abrir em tela cheia
                </Link>
              </div>

              {/* Telas largas: a planilha de verdade, com rolagem própria dentro da moldura. */}
              <div className="hidden h-[40rem] min-w-0 lg:grid lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain">
                  <SheetStage sheetId={NOVEMBER} />
                </div>
                <div className="flex min-h-0 min-w-0 flex-col border-l border-line">
                  <AgentPanel sheetId={NOVEMBER} />
                </div>
              </div>

              {/* Telas estreitas: uma prévia curta e estática, sem rolagem aninhada. A planilha completa abre em /demo. */}
              <div className="lg:hidden">
                {numbers && split ? (
                  <div className="ruled">
                    <div className="grid gap-5 px-4 py-5">
                      <Split label="Essenciais" actual={numbers.essenciais} income={base} target={split.essenciais / 100} color={SLICE_COLOR.essenciais} delay={0} />
                      <Split label="Estilo de vida" actual={numbers.estilo} income={base} target={split.estilo / 100} color={SLICE_COLOR.estilo} delay={0.06} />
                      <Split label="Futuro" actual={numbers.futuro} income={base} target={split.futuro / 100} color={SLICE_COLOR.futuro} delay={0.12} />
                    </div>
                    <table className="w-full text-sm">
                      <caption className="sr-only">Últimos lançamentos de {sheet?.name}</caption>
                      <thead>
                        <tr className="col-label text-left">
                          <th scope="col" className="w-24 px-4 py-2 font-normal whitespace-nowrap"><span aria-hidden="true">A&nbsp;&nbsp;</span>DATA</th>
                          <th scope="col" className="py-2 font-normal"><span aria-hidden="true">B&nbsp;&nbsp;</span>DESCRIÇÃO</th>
                          <th scope="col" className="px-4 py-2 text-right font-normal"><span aria-hidden="true">C&nbsp;&nbsp;</span>VALOR</th>
                        </tr>
                      </thead>
                      <tbody className="[&>tr]:border-t [&>tr]:border-line">
                        {latest.map((entry) => (
                          <tr key={entry.id}>
                            <td className="num px-4 py-2.5 align-baseline text-xs whitespace-nowrap text-faint">{formatDay(entry.date)}</td>
                            <td className="py-2.5 pr-2 align-baseline break-words">{entry.title}</td>
                            <td className={`num px-4 py-2.5 text-right align-baseline whitespace-nowrap ${entry.type === "receita" ? "text-mint" : "text-ink"}`}>
                              {entry.type === "receita" ? "+" : "−"}
                              {formatBRL(entry.cents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-4 py-4">
                      <Link href="/demo" className={`${primary} w-full`}>
                        Abrir em tela cheia
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-muted">
              Esta janela é uma demonstração que fica só neste navegador. Na conta, a planilha é cifrada com a sua senha.
            </p>
          </Reveal>
        </section>

        <Section id="ciclos" col="02" label="CICLOS">
          <h2 className={`${headline} max-w-3xl`}>O mês fecha. A meta tem prazo. A reserva fica.</h2>
          <p className="mt-5 max-w-xl text-muted">Você escolhe o tipo ao criar a planilha. Nenhuma folha tenta ser as três coisas.</p>
          <div className="mt-12 grid overflow-hidden rounded-lg border border-line md:grid-cols-3 md:divide-x md:divide-line max-md:divide-y max-md:divide-line">
            <Cycle col="A" tag="MENSAL" title="Ciclo mensal" body="O balanço vira quando o mês acaba. Duplicar mês leva salário, contas fixas e assinaturas." />
            <Cycle col="B" tag="META" title="Meta com prazo" body="Viagem, dívida ou compra. Uma barra, uma data, um valor, separados do aluguel." />
            <Cycle col="C" tag="CONTÍNUA" title="Visão contínua" body="Reserva e patrimônio num lugar fixo, fora do mês que fecha." />
          </div>
        </Section>

        <Section id="agente" col="03" label="AGENTE">
          <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className={headline}>Fale o gasto. A linha aparece.</h2>
              <p className="mt-5 max-w-md text-muted">
                O agente não é um modelo de IA. Ele lê valor, categoria e data em frases curtas e responde com os números da sua planilha.
              </p>
            </div>
            <div className="min-w-0 self-start rounded-lg border border-line">
              <div className="col-label hidden grid-cols-2 gap-6 border-b border-line px-4 py-2 sm:grid" aria-hidden="true">
                <span>A&nbsp;&nbsp;VOCÊ ESCREVE</span>
                <span>B&nbsp;&nbsp;O AGENTE LANÇA</span>
              </div>
              <dl className="ruled">
                {sheet
                  ? PHRASES.map((phrase) => {
                      const outcome = interpret(phrase, state, sheet);
                      return (
                        <div key={phrase} className="grid gap-1 px-4 py-3.5 sm:grid-cols-2 sm:items-baseline sm:gap-6">
                          <dt className="text-ink">“{phrase}”</dt>
                          <dd className="text-sm leading-relaxed whitespace-pre-line text-muted">
                            {outcome.entry ? (
                              <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                                <span>
                                  <span aria-hidden="true" className="text-faint">→ </span>
                                  {outcome.entry.category}, {ENTRY_LABEL[outcome.entry.type].toLowerCase()}
                                </span>
                                <span className="num text-ink">{formatBRL(outcome.entry.cents)}</span>
                              </span>
                            ) : (
                              <>
                                <span aria-hidden="true" className="text-faint">→ </span>
                                {outcome.reply}
                              </>
                            )}
                          </dd>
                        </div>
                      );
                    })
                  : null}
              </dl>
            </div>
          </div>
        </Section>

        <Section id="divisao" col="04" label="DIVISÃO">
          <h2 className={`${headline} max-w-3xl`}>Essencial, estilo e futuro na mesma régua.</h2>
          <p className="mt-5 max-w-xl text-muted">A marca fina é a divisão que você escolheu. A barra é o que já saiu das entradas do mês.</p>
          {numbers && split ? (
            <div className="mt-12 grid items-end gap-10 md:grid-cols-[1.4fr_0.6fr]">
              <div className="ruled border-y border-line">
                <div className="py-5">
                  <Split label="Essenciais" actual={numbers.essenciais} income={base} target={split.essenciais / 100} color={SLICE_COLOR.essenciais} delay={0} />
                </div>
                <div className="py-5">
                  <Split label="Estilo de vida" actual={numbers.estilo} income={base} target={split.estilo / 100} color={SLICE_COLOR.estilo} delay={0.06} />
                </div>
                <div className="py-5">
                  <Split label="Futuro" actual={numbers.futuro} income={base} target={split.futuro / 100} color={SLICE_COLOR.futuro} delay={0.12} />
                </div>
              </div>
              <div>
                <p className="num text-[clamp(2.5rem,5vw,4rem)] leading-none tracking-tight">
                  {split.essenciais}/{split.estilo}/{split.futuro}
                </p>
                <p className="col-label mt-3">ESSENCIAL / ESTILO / FUTURO</p>
              </div>
            </div>
          ) : null}
        </Section>

        <Section id="aprender" col="05" label="APRENDER">
          <h2 className={`${headline} max-w-3xl`}>{COUNT_WORD[trails.length] ?? trails.length} trilhas, sem curso de doze horas.</h2>
          <ol className="ruled mt-12 border-y border-line">
            {trails.map((trail, index) => (
              <li key={trail.id} className="grid gap-1 py-4 sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1.1fr)] sm:items-baseline sm:gap-6">
                <span className="col-label" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="text-xl">{trail.title}</h3>
                <p className="text-sm text-muted">Começa por: {trail.pills[0]?.title.toLowerCase()}.</p>
              </li>
            ))}
          </ol>
        </Section>

        <section className="relative overflow-hidden border-t border-line">
          <div className="sheet-grid sheet-grid-fade pointer-events-none absolute inset-0" aria-hidden="true" />
          <Reveal className="relative mx-auto max-w-6xl px-4 py-24">
            <h2 className="display max-w-4xl text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95]">O extrato não se organiza sozinho.</h2>
            <p className="mt-5 max-w-lg text-muted">Abre no navegador ou instala no Windows. A planilha fica cifrada na sua conta.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/criar-conta" className={primary}>
                Criar conta
              </Link>
              <Link href="/entrar" className={secondary}>
                Entrar
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-4">
          <div>
            <div className="display flex items-center gap-2 text-xl">
              <Mark className="size-7" />
              Lâmina
            </div>
            <p className="mt-3 text-sm text-muted">Planilha no palco. Agente na lateral.</p>
          </div>
          <FooterCol title="Produto" links={[["Ciclos", "/#ciclos"], ["Agente", "/#agente"], ["Divisão", "/#divisao"]]} />
          <FooterCol title="Experimentar" links={[["Demonstração", "/demo"], ["Instalar no Windows", "/baixar"]]} />
          <FooterCol title="Conta" links={[["Entrar", "/entrar"], ["Criar conta", "/criar-conta"], ["Termos", "/termos"], ["Privacidade", "/privacidade"]]} />
        </div>
      </footer>
    </div>
  );
}

// Cada seção abre com o rótulo de coluna da planilha e um fio, como o cabeçalho de uma folha.
function Section({ id, col, label, children }: { id: string; col: string; label: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-14 border-t border-line">
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-20">
        <Reveal>
        <p className="col-label mb-10 flex items-center gap-3" aria-hidden="true">
          <span>{col}</span>
          <span>{label}</span>
          <span className="h-px flex-1 bg-line" />
        </p>
        {children}
        </Reveal>
      </div>
    </section>
  );
}

function LedgerRow({ n, k, v, tone = "", total = false }: { n: number; k: string; v: ReactNode; tone?: string; total?: boolean }) {
  return (
    <tr className={total ? "border-t-ink/40! bg-surface-2/60" : ""}>
      <td className="col-label w-9 px-3 py-2.5 align-baseline" aria-hidden="true">{n}</td>
      <th scope="row" className={`py-2.5 text-left align-baseline font-normal ${total ? "text-ink" : "text-muted"}`}>{k}</th>
      <td className={`num px-3 py-2.5 text-right align-baseline whitespace-nowrap ${total ? "text-lg text-ink" : tone}`}>{v}</td>
    </tr>
  );
}

function Cycle({ col, tag, title, body }: { col: string; tag: string; title: string; body: string }) {
  return (
    <div className="p-5">
      <p className="col-label" aria-hidden="true">{col}&nbsp;&nbsp;{tag}</p>
      <h3 className="mt-4 text-xl">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: string[][] }) {
  return (
    <div>
      <p className="col-label">{title.toUpperCase()}</p>
      <ul className="mt-3 space-y-1 text-sm">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="inline-flex min-h-10 items-center text-muted hover:text-ink">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
