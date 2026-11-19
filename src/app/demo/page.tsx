"use client";

import Link from "next/link";
import { AgentPanel } from "@/components/agent-panel";
import { Mark } from "@/components/mark";
import { SheetStage } from "@/components/sheet-stage";
import { NOVEMBER } from "@/lib/store";

export default function DemoPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm">
          <Mark className="size-7" />
          Lâmina, demonstração
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/entrar" className="inline-flex min-h-11 items-center rounded-full px-3 text-sm text-muted hover:text-ink">
            Entrar
          </Link>
          <Link href="/criar-conta" className="press inline-flex min-h-11 items-center rounded-full bg-violet px-4 text-sm font-medium text-ink hover:bg-[#5d3de0]">
            Criar conta
          </Link>
        </div>
      </header>
      <p className="px-4 pt-3 text-sm text-muted">Os números ficam só neste navegador. Para guardar de verdade, crie uma conta.</p>
      <div className="grid min-h-0 min-w-0 flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <SheetStage sheetId={NOVEMBER} />
        </div>
        <div className="flex min-h-[28rem] min-w-0 flex-col border-t border-line lg:sticky lg:top-0 lg:h-dvh lg:border-t-0 lg:border-l">
          <AgentPanel sheetId={NOVEMBER} />
        </div>
      </div>
    </div>
  );
}
