"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Mark } from "@/components/mark";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative flex h-dvh flex-col justify-center overflow-hidden px-4">
      <div className="sheet-grid sheet-grid-fade pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto w-full max-w-2xl">
        <Link href="/" className="display inline-flex min-h-10 items-center gap-2 text-xl">
          <Mark className="size-7" />
          Lâmina
        </Link>
        <p className="col-label mt-8">ERRO · A FÓRMULA FALHOU</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Algo travou aqui.</h1>
        <p className="mt-5 max-w-md text-muted">Os dados que já estão salvos não foram mexidos. Tente de novo; se repetir, volte ao início.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="press inline-flex min-h-11 items-center justify-center rounded-md bg-violet px-5 text-sm font-medium text-ink hover:bg-[#5d3de0]"
          >
            Tentar de novo
          </button>
          <Link href="/" className="press inline-flex min-h-11 items-center justify-center rounded-md border border-line px-5 text-sm font-medium text-ink hover:border-violet-2 hover:bg-surface-2">
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}
