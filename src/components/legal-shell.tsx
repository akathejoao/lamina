import Link from "next/link";
import type { ReactNode } from "react";
import { Mark } from "./mark";

export function LegalShell({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted">
        <Mark className="size-7" />
        Lâmina
      </Link>
      <p className="kicker mt-8">{kicker}</p>
      <h1 className="display mt-3 text-4xl">{title}</h1>
      <article className="mt-6 space-y-4 text-sm leading-relaxed text-muted [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:text-ink">{children}</article>
    </main>
  );
}
