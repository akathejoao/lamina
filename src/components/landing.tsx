"use client";

import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { motion } from "motion/react";
import { mathFor, tips } from "@/lib/finance";
import { formatBRL, formatMonth, todayISO } from "@/lib/money";
import { NOVEMBER, useStore } from "@/lib/store";
import { AgentPanel } from "./agent-panel";
import { Mark } from "./mark";
import { SheetStage } from "./sheet-stage";

const easeOut = [0.22, 1, 0.36, 1] as const;

export function Landing() {
  const reduce = useReducedMotion();
  const { state } = useStore();
  const sheet = state.sheets.find((item) => item.id === NOVEMBER);
  const numbers = sheet ? mathFor(state, sheet) : null;
  const tip = sheet ? tips(state, sheet)[0] : "";
  const rise = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-10% 0px" },
        transition: { duration: 0.45, ease: easeOut },
      };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[920px] grid-fade" />
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <Mark className="size-8" />
            Lâmina
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-muted md:flex" aria-label="Seções">
            <a href="#ciclos">Ciclos</a>
            <a href="#agente">Agente</a>
            <a href="#divisao">Divisão</a>
            <a href="#aprender">Aprender</a>
            <Link href="/baixar">Baixar</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/app" className="hidden min-h-11 items-center rounded-full px-3 text-sm text-muted sm:inline-flex">
              Entrar
            </Link>
            <Link href="/app" className="inline-flex min-h-11 items-center rounded-full bg-violet px-4 text-sm font-medium">
              Abrir no navegador
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-end gap-10 px-4 pb-8 pt-16 md:grid-cols-[1.4fr_0.6fr] md:pt-24">
          <motion.div {...(reduce ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: easeOut } })}>
            <p className="kicker">Planilha financeira · agente ao lado</p>
            <h1 className="display mt-4 text-[clamp(3.2rem,8vw,7.2rem)]">
              O mês inteiro
              <span className="block">numa tela só.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              A planilha fica no palco. O agente fica na lateral e lança o que você escreve. Sem aba escondida, sem fórmula que quebra no dia 31.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/app" className="inline-flex min-h-12 items-center rounded-full bg-violet px-5 text-sm font-medium">
                Abrir app no navegador
              </Link>
              <Link href="/baixar" className="inline-flex min-h-12 items-center rounded-full border border-line px-5 text-sm font-medium hover:border-violet-2">
                Baixar para Windows
              </Link>
            </div>
          </motion.div>
          <motion.aside {...rise} className="rounded-2xl border border-line bg-surface p-4">
            <p className="kicker">Recibo de {sheet?.month ? formatMonth(sheet.month) : "hoje"}</p>
            <dl className="mt-4 space-y-3 text-sm">
              <Row k="Entradas" v={numbers ? formatBRL(numbers.income) : "—"} />
              <Row k="Saídas" v={numbers ? formatBRL(numbers.burn) : "—"} />
              <Row k="Aportes" v={numbers ? formatBRL(numbers.invested) : "—"} />
              <Row k="Livre" v={numbers ? formatBRL(numbers.free) : "—"} strong />
              <Row k="Por dia" v={numbers ? formatBRL(numbers.daily) : "—"} />
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-faint">Atualiza quando você mexe na planilha aqui embaixo. Hoje é {todayISO().split("-").reverse().join("/")}.</p>
          </motion.aside>
        </section>

        <section id="palco" className="mx-auto max-w-6xl px-4 pb-24">
          <div className="max-w-full overflow-hidden rounded-3xl border border-line bg-canvas shadow-[0_30px_80px_rgb(0_0_0/0.45)]">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <Mark className="size-5" />
                Lâmina · {sheet?.name}
              </div>
              <Link href={`/app/planilha/${NOVEMBER}`} className="text-sm text-violet-2">
                Abrir em tela cheia
              </Link>
            </div>
            <div className="grid min-w-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 overflow-hidden">
                <SheetStage sheetId={NOVEMBER} compact />
              </div>
              <div className="min-w-0 border-t border-line lg:border-t-0 lg:border-l">
                <AgentPanel sheetId={NOVEMBER} compact />
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm text-faint">
            Esta janela é uma demonstração neste navegador. A conta guarda a planilha cifrada, com o nome e o e-mail separados dos números.
          </p>
        </section>

        <section id="ciclos" className="border-t border-line">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 md:grid-cols-2">
            <motion.div {...rise}>
              <p className="kicker">Três jeitos de abrir</p>
              <h2 className="display mt-4 text-5xl md:text-6xl">O mês fecha. A meta tem prazo. A reserva fica.</h2>
              <p className="mt-5 max-w-md text-muted">
                Você escolhe o tipo na hora de criar. Não existe uma planilha infinita tentando ser as três coisas.
              </p>
            </motion.div>
            <motion.ol {...rise} className="space-y-3">
              <Cycle n="01" title="Ciclo mensal" body="O balanço vira sozinho quando o mês acaba. Duplicar mês leva salário, contas fixas e assinaturas." />
              <Cycle n="02" title="Meta com prazo" body="Viagem, dívida ou compra. Uma barra, uma data, um valor. Sem misturar com o aluguel." />
              <Cycle n="03" title="Visão contínua" body="A casa fixa do patrimônio. Reserva e evolução anual moram aqui, não numa aba perdida." />
            </motion.ol>
          </div>
        </section>

        <section id="agente" className="border-t border-line">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 md:grid-cols-[0.9fr_1.1fr]">
            <motion.div {...rise} className="rounded-3xl border border-line bg-surface p-5">
              <p className="kicker">Conversa real desta planilha</p>
              <div className="mt-4 space-y-3 text-sm leading-relaxed">
                <p className="rounded-2xl bg-canvas px-3 py-2">Gastei R$ 85 no mercado hoje</p>
                <p className="rounded-2xl bg-canvas-2 px-3 py-2 text-muted">
                  O agente cria a linha, escolhe a categoria e devolve o livre do mês. Prints e CSV também entram pelo mesmo campo.
                </p>
                <p className="rounded-2xl bg-canvas px-3 py-2">{tip}</p>
              </div>
            </motion.div>
            <motion.div {...rise}>
              <p className="kicker">Ao lado, não no lugar</p>
              <h2 className="display mt-4 text-5xl md:text-6xl">Fale o gasto. A linha aparece.</h2>
              <p className="mt-5 max-w-md text-muted">
                “Quanto posso gastar por dia até o fim do mês?” e “Simule se eu guardar R$ 400” usam os números que já estão lançados. Não é um texto genérico de educação financeira.
              </p>
            </motion.div>
          </div>
        </section>

        <section id="divisao" className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-24 md:grid-cols-[1fr_1fr]">
            <motion.div {...rise}>
              <p className="kicker">50 / 30 / 20</p>
              <h2 className="display mt-4 text-5xl md:text-6xl">Essencial, estilo e futuro na mesma régua.</h2>
              <p className="mt-5 max-w-md text-muted">
                A marca na barra é a meta. O preenchimento é o que já saiu. Lazer alto aparece como dica com valor, não como conselho vazio.
              </p>
            </motion.div>
            <motion.div {...rise} className="grid gap-3">
              <Tile title="Cartões e assinaturas" body="Parcelas ficam com o contador 3/12. Assinaturas pequenas mostram o custo do ano." />
              <Tile title="Vencimentos" body="A tela inicial lista o que vence nos próximos sete dias, com o valor ao lado." />
              <Tile title="Metas" body={numbers ? `Reserva e viagem têm barra própria. Livre neste ciclo: ${formatBRL(numbers.free)}.` : "Barras de progresso por objetivo."} />
            </motion.div>
          </div>
        </section>

        <section id="aprender" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-24">
            <motion.div {...rise} className="max-w-2xl">
              <p className="kicker">Dentro do app</p>
              <h2 className="display mt-4 text-5xl md:text-6xl">Quatro trilhas, sem curso de doze horas.</h2>
            </motion.div>
            <div className="mt-10 grid gap-3 md:grid-cols-4">
              {["Sair das dívidas", "Montar a reserva", "Negociar fixos", "Começar a investir"].map((title, index) => (
                <motion.article key={title} {...rise} className={`rounded-2xl border border-line p-4 ${index === 0 ? "md:col-span-2 md:row-span-1 bg-surface" : "bg-canvas-2"}`}>
                  <p className="kicker">0{index + 1}</p>
                  <h3 className="mt-3 text-2xl">{title}</h3>
                  <p className="mt-2 text-sm text-muted">Pílulas curtas, com o que fazer esta semana.</p>
                </motion.article>
              ))}
            </div>
            <Link href="/app/educacao" className="mt-6 inline-flex min-h-11 items-center text-sm text-violet-2">
              Abrir as trilhas
            </Link>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-28 text-center">
            <h2 className="display text-[clamp(2.8rem,7vw,6rem)]">O extrato não se organiza sozinho.</h2>
            <p className="mx-auto mt-5 max-w-lg text-muted">A planilha, com o agente do lado, organiza. Abre no navegador ou instala no Windows.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/app" className="inline-flex min-h-12 items-center rounded-full bg-ink px-5 text-sm font-medium text-canvas">
                Abrir app no navegador
              </Link>
              <Link href="/baixar" className="inline-flex min-h-12 items-center rounded-full border border-line px-5 text-sm">
                Baixar para Windows
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
            <p className="mt-3 text-sm text-faint">Planilha no palco. Agente na lateral.</p>
          </div>
          <FooterCol title="Produto" links={[["Ciclos", "/#ciclos"], ["Agente", "/#agente"], ["Divisão", "/#divisao"]]} />
          <FooterCol title="App" links={[["Início", "/app"], ["Perfil", "/app/perfil"], ["Aprender", "/app/educacao"], ["Windows", "/baixar"]]} />
          <FooterCol title="Conta" links={[["Entrar", "/entrar"], ["Criar conta", "/criar-conta"], ["Termos", "/termos"], ["Privacidade", "/privacidade"]]} />
        </div>
      </footer>
    </div>
  );
}

function Row({ k, v, strong = false }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
      <dt className="text-muted">{k}</dt>
      <dd className={`num ${strong ? "text-lg text-ink" : ""}`}>{v}</dd>
    </div>
  );
}

function Cycle({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <p className="kicker">{n}</p>
      <h3 className="mt-2 text-xl">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
    </li>
  );
}

function Tile({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="text-lg">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
    </article>
  );
}

function FooterCol({ title, links }: { title: string; links: string[][] }) {
  return (
    <div>
      <p className="kicker">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-muted hover:text-ink">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
