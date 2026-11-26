"use client";

import Link from "next/link";
import { useState } from "react";
import { AgentPanel } from "@/components/agent-panel";
import { Mark } from "@/components/mark";
import { SheetStage } from "@/components/sheet-stage";
import { NOVEMBER } from "@/lib/store";

type View = "planilha" | "agente";

export default function DemoPage() {
  const [view, setView] = useState<View>("planilha");
  const tab = (id: View, label: string) => (
    <button
      type="button"
      role="tab"
      id={`demo-tab-${id}`}
      aria-selected={view === id}
      aria-controls={`demo-panel-${id}`}
      onClick={() => setView(id)}
      className={`tint min-h-10 rounded-md text-sm ${view === id ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2">
        <Link href="/" className="display inline-flex min-h-10 items-center gap-2 text-xl">
          <Mark className="size-7" />
          Lâmina
          <span className="col-label hidden pl-1 sm:inline">DEMONSTRAÇÃO</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/entrar" className="tint inline-flex min-h-10 items-center rounded-md px-3 text-sm text-muted hover:text-ink">
            Entrar
          </Link>
          <Link href="/criar-conta" className="press inline-flex min-h-10 items-center rounded-md bg-violet px-4 text-sm font-medium text-ink hover:bg-[#5d3de0]">
            Criar conta
          </Link>
        </div>
      </header>
      <p className="shrink-0 border-b border-line px-4 py-2 text-sm text-muted">Os números ficam só neste navegador. Para guardar de verdade, crie uma conta.</p>

      {/* Em telas estreitas, planilha e agente se alternam e cada um ocupa a altura toda. */}
      <div className="grid shrink-0 grid-cols-2 gap-1 border-b border-line px-4 py-2 lg:hidden" role="tablist" aria-label="Planilha e agente">
        {tab("planilha", "Planilha")}
        {tab("agente", "Agente")}
      </div>

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div
          id="demo-panel-planilha"
          role="tabpanel"
          aria-labelledby="demo-tab-planilha"
          className={`min-h-0 min-w-0 overflow-y-auto overscroll-contain lg:block ${view === "planilha" ? "block" : "hidden"}`}
        >
          <SheetStage sheetId={NOVEMBER} />
        </div>
        <div
          id="demo-panel-agente"
          role="tabpanel"
          aria-labelledby="demo-tab-agente"
          className={`min-h-0 min-w-0 flex-col border-line lg:flex lg:border-l ${view === "agente" ? "flex" : "hidden"}`}
        >
          <AgentPanel sheetId={NOVEMBER} />
        </div>
      </div>
    </div>
  );
}
