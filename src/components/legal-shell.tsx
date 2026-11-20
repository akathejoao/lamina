import Link from "next/link";
import type { ReactNode } from "react";
import { Mark } from "./mark";

export function LegalShell({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <main className="relative mx-auto flex h-dvh max-w-2xl flex-col overflow-hidden px-4 pt-6 sm:pt-10">
      <Link href="/" className="inline-flex shrink-0 items-center gap-2 self-start text-sm text-muted">
        <Mark className="size-7" />
        Lâmina
      </Link>
      <p className="kicker mt-6 shrink-0">{kicker}</p>
      <h1 className="display mt-3 shrink-0 text-4xl">{title}</h1>
      <article className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pb-10 text-sm leading-relaxed text-muted [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:text-ink">{children}</article>
    </main>
  );
}
