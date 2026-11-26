import Link from "next/link";
import type { ReactNode } from "react";
import { Mark } from "./mark";

// Texto legal numa coluna só: cada título de seção ganha um fio e um número de linha, como cláusulas numa folha.
// O documento não rola. A coluna de texto rola por dentro, e o cabeçalho fica parado.
export function LegalShell({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <main className="relative mx-auto flex h-dvh max-w-2xl flex-col overflow-hidden px-4">
      <div className="shrink-0 border-b border-line pt-4 pb-5 sm:pt-8">
        <Link href="/" className="display inline-flex min-h-10 items-center gap-2 text-xl">
          <Mark className="size-7" />
          Lâmina
        </Link>
        <p className="col-label mt-5">{kicker.toUpperCase()}</p>
        <h1 className="display mt-3 text-3xl sm:text-4xl">{title}</h1>
      </div>
      <article
        tabIndex={0}
        aria-label={title}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain py-6 pb-12 text-sm leading-relaxed text-muted [counter-reset:clause] focus-visible:outline-offset-[-3px] [&_h2]:mt-10 [&_h2]:border-t [&_h2]:border-line [&_h2]:pt-5 [&_h2]:text-xl [&_h2]:text-ink [&_h2]:[counter-increment:clause] [&_h2]:before:mb-2 [&_h2]:before:block [&_h2]:before:font-mono [&_h2]:before:text-xs [&_h2]:before:tracking-[0.06em] [&_h2]:before:text-faint [&_h2]:before:content-[counter(clause,decimal-leading-zero)] [&_h2:first-child]:mt-0"
      >
        {children}
      </article>
    </main>
  );
}
