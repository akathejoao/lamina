"use client";

import Link from "next/link";
import { interpret } from "@/lib/agent";
import { mathFor } from "@/lib/finance";
import { trails } from "@/lib/learn";
import { formatBRL, formatMonth, todayISO } from "@/lib/money";
import { SLICE_COLOR, splitOf } from "@/lib/sheets";
import { NOVEMBER, useStore } from "@/lib/store";
import { ENTRY_LABEL } from "@/lib/types";
import { AgentPanel } from "./agent-panel";
import { Mark } from "./mark";
import { SheetStage, Split } from "./sheet-stage";

const PHRASES = ["Gastei R$ 85 no mercado hoje", "100 reais de uber", "Recebi R$ 400 de freelance", "Netflix é 55,90"];

const primary = "press inline-flex min-h-12 items-center rounded-full bg-violet px-5 text-sm font-medium text-ink hover:bg-[#5d3de0]";
const secondary = "press inline-flex min-h-12 items-center rounded-full border border-line px-5 text-sm font-medium text-ink hover:border-violet-2";

export function Landing() {
  const { state } = useStore();
  const sheet = state.sheets.find((item) => item.id === NOVEMBER);
  const numbers = sheet ? mathFor(state, sheet) : null;
  const split = sheet ? splitOf(sheet) : null;
  const base = numbers ? (numbers.income > 0 ? numbers.income : numbers.essenciais + numbers.estilo + numbers.futuro) : 0;

  return (
    <div className="relative">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <Mark className="size-8" />
            Lâmina
          </Link>
          <nav className="hidden items-center gap-1 text-sm text-muted md:flex" aria-label="Seções">
            <a className="rounded-full px-3 py-2 hover:text-ink" href="#ciclos">Ciclos</a>
            <a className="rounded-full px-3 py-2 hover:text-ink" href="#agente">Agente</a>
            <a className="rounded-full px-3 py-2 hover:text-ink" href="#divisao">Divisão</a>
            <a className="rounded-full px-3 py-2 hover:text-ink" href="#aprender">Aprender</a>
            <Link className="rounded-full px-3 py-2 hover:text-ink" href="/baixar">Baixar</Link>
          </nav>
          <div className="flex items-center gap-1">
            <Link href="/entrar" className="inline-flex min-h-11 items-center rounded-full px-3 text-sm text-muted hover:text-ink">
              Entrar
            </Link>
            <Link href="/criar-conta" className="press inline-flex min-h-11 items-center rounded-full bg-violet px-4 text-sm font-medium text-ink hover:bg-[#5d3de0]">
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-end gap-10 px-4 pt-14 pb-10 md:grid-cols-[1.35fr_0.65fr] md:pt-20">
          <div className="hero-in">
            <h1 className="display text-[clamp(2.75rem,6.2vw,5rem)] leading-[0.95]">O mês inteiro numa tela só.</h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
              Escreva o gasto como fala. O agente lança na planilha e mostra quanto ainda cabe no mês.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/criar-conta" className={primary}>
                Criar conta
              </Link>
              <Link href="/entrar" className={secondary}>
                Entrar
              </Link>
            </div>
          </div>
          <aside className="rounded-2xl border border-line bg-surface p-4" aria-label="Resumo do exemplo">
            <p className="kicker">{sheet?.month ? `${formatMonth(sheet.month)}, em números` : "O mês em números"}</p>
            <dl className="mt-3 divide-y divide-line text-sm">
              <Row k="Entradas" v={numbers ? formatBRL(numbers.income) : "sem dados"} />
              <Row k="Saídas" v={numbers ? formatBRL(numbers.burn) : "sem dados"} />
              <Row k="Guardado" v={numbers ? formatBRL(numbers.invested) : "sem dados"} />
              <Row k="Livre" v={numbers ? formatBRL(numbers.free) : "sem dados"} strong />
              <Row k="Por dia" v={numbers ? formatBRL(numbers.daily) : "sem dados"} />
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Muda quando você mexe na planilha abaixo. Hoje é {todayISO().split("-").reverse().join("/")}.
            </p>
          </aside>
        </section>

        <section id="palco" className="mx-auto max-w-6xl px-4 pb-24">
          <div className="max-w-full overflow-hidden rounded-3xl border border-line bg-canvas">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <Mark className="size-5" />
                Exemplo: {sheet?.name}
              </div>
              <Link href="/demo" className="inline-flex min-h-9 items-center text-sm text-violet-2">
                Abrir em tela cheia
              </Link>
            </div>
            <div className="grid min-w-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 overflow-hidden">
                <SheetStage sheetId={NOVEMBER} compact />
              </div>
              <div className="flex min-w-0 flex-col border-t border-line lg:border-t-0 lg:border-l">
                <AgentPanel sheetId={NOVEMBER} compact />
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">
            Esta janela é uma demonstração que fica só neste navegador. Na conta, a planilha é cifrada com a sua senha.
          </p>
        </section>

        <section id="ciclos" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="display max-w-3xl text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[0.95]">O mês fecha. A meta tem prazo. A reserva fica.</h2>
            <p className="mt-5 max-w-xl text-muted">Você escolhe o tipo ao criar a planilha. Nenhuma folha tenta ser as três coisas.</p>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <Cycle title="Ciclo mensal" body="O balanço vira quando o mês acaba. Duplicar mês leva salário, contas fixas e assinaturas." />
              <Cycle title="Meta com prazo" body="Viagem, dívida ou compra. Uma barra, uma data, um valor, separados do aluguel." />
              <Cycle title="Visão contínua" body="Reserva e patrimônio num lugar fixo, fora do mês que fecha." />
            </div>
          </div>
        </section>

        <section id="agente" className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 md:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="display text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[0.95]">Fale o gasto. A linha aparece.</h2>
              <p className="mt-5 max-w-md text-muted">
                O agente não é um modelo de IA. Ele lê valor, categoria e data em frases curtas e responde com os números da sua planilha.
              </p>
            </div>
            <dl className="divide-y divide-line border-y border-line">
              {sheet
                ? PHRASES.map((phrase) => {
                    const outcome = interpret(phrase, state, sheet);
                    return (
                      <div key={phrase} className="grid gap-1 py-4 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-6">
                        <dt className="text-ink">“{phrase}”</dt>
                        <dd className="text-sm text-muted">
                          {outcome.entry ? (
                            <>
                              {outcome.entry.category}, {ENTRY_LABEL[outcome.entry.type].toLowerCase()},{" "}
                              <span className="num text-ink">{formatBRL(outcome.entry.cents)}</span>
                            </>
                          ) : (
                            outcome.reply
                          )}
                        </dd>
                      </div>
                    );
                  })
                : null}
            </dl>
          </div>
        </section>

        <section id="divisao" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="display max-w-3xl text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[0.95]">Essencial, estilo e futuro na mesma régua.</h2>
            <p className="mt-5 max-w-xl text-muted">A marca fina é a divisão que você escolheu. A barra é o que já saiu das entradas do mês.</p>
            {numbers && split ? (
              <div className="mt-12 grid max-w-3xl gap-5">
                <Split label="Essenciais" actual={numbers.essenciais} income={base} target={split.essenciais / 100} color={SLICE_COLOR.essenciais} delay={0} />
                <Split label="Estilo de vida" actual={numbers.estilo} income={base} target={split.estilo / 100} color={SLICE_COLOR.estilo} delay={0} />
                <Split label="Futuro" actual={numbers.futuro} income={base} target={split.futuro / 100} color={SLICE_COLOR.futuro} delay={0} />
              </div>
            ) : null}
          </div>
        </section>

        <section id="aprender" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="display max-w-3xl text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[0.95]">Quatro trilhas, sem curso de doze horas.</h2>
            <ul className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {trails.map((trail) => (
                <li key={trail.id} className="border-t border-line pt-4">
                  <h3 className="text-xl">{trail.title}</h3>
                  <p className="mt-2 text-sm text-muted">Começa por: {trail.pills[0]?.title.toLowerCase()}.</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-24 text-center">
            <h2 className="display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95]">O extrato não se organiza sozinho.</h2>
            <p className="mx-auto mt-5 max-w-lg text-muted">Abre no navegador ou instala no Windows. A planilha fica cifrada na sua conta.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/criar-conta" className={primary}>
                Criar conta
              </Link>
              <Link href="/entrar" className={secondary}>
                Entrar
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
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

function Row({ k, v, strong = false }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-muted">{k}</dt>
      <dd className={`num ${strong ? "text-lg text-ink" : ""}`}>{v}</dd>
    </div>
  );
}

function Cycle({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t border-line pt-4">
      <h3 className="text-xl">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: string[][] }) {
  return (
    <div>
      <p className="text-sm text-ink">{title}</p>
      <ul className="mt-3 space-y-1 text-sm">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="inline-flex min-h-9 items-center text-muted hover:text-ink">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
