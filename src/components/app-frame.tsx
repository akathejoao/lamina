"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GraduationCap, House, MessageSquareText, Shield, Table2, UserRound } from "lucide-react";
import { currentMonthly } from "@/lib/finance";
import { useStore, type SaveState } from "@/lib/store";
import { Mark } from "./mark";

type SideSlot = {
  element: HTMLElement | null;
  claim: () => void;
  release: () => void;
};

const SideContext = createContext<SideSlot | null>(null);

export function SidePortal({ children }: { children: ReactNode }) {
  const slot = useContext(SideContext);
  useEffect(() => {
    if (!slot) return;
    slot.claim();
    return () => slot.release();
  }, [slot]);
  if (!slot?.element) return null;
  return createPortal(children, slot.element);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state, logout, saveNote, saveState, retrySave, scope, role } = useStore();
  const current = currentMonthly(state);
  const [agentPath, setAgentPath] = useState<string | null>(null);
  const agentOpen = agentPath === pathname;
  const [sideCount, setSideCount] = useState(0);
  const [sideElement, setSideElement] = useState<HTMLDivElement | null>(null);
  const claim = useCallback(() => setSideCount((count) => count + 1), []);
  const release = useCallback(() => setSideCount((count) => Math.max(0, count - 1)), []);
  const sideSlot = useMemo<SideSlot>(() => ({ element: sideElement, claim, release }), [sideElement, claim, release]);
  const hasSide = sideCount > 0;

  return (
      <SideContext.Provider value={sideSlot}>
        <div className="relative h-dvh overflow-hidden bg-canvas text-ink">
          <div className="flex h-full min-h-0">
            <nav className="hidden h-full w-16 shrink-0 flex-col items-center gap-3 border-r border-line py-4 md:flex" aria-label="App">
              <Link href={scope === "conta" ? "/app" : "/"} aria-label={scope === "conta" ? "Lâmina, início do app" : "Lâmina, página inicial"} className="mb-4">
                <Mark />
              </Link>
              <RailLink href="/app" label="Início" active={pathname === "/app"}>
                <House className="size-5" />
              </RailLink>
              <RailLink href={current ? `/app/planilha/${current.id}` : "/app"} label="Planilha" active={pathname.startsWith("/app/planilha")}>
                <Table2 className="size-5" />
              </RailLink>
              <RailLink href="/app/educacao" label="Aprender" active={pathname.startsWith("/app/educacao")}>
                <GraduationCap className="size-5" />
              </RailLink>
              <RailLink href="/app/perfil" label="Perfil" active={pathname.startsWith("/app/perfil")}>
                <UserRound className="size-5" />
              </RailLink>
              {role === "admin" ? (
                <RailLink href="/app/admin" label="Administração" active={pathname.startsWith("/app/admin")}>
                  <Shield className="size-5" />
                </RailLink>
              ) : null}
              {logout ? (
                <button type="button" className="mt-auto min-h-11 px-2 text-xs text-muted hover:text-ink" onClick={() => void logout()}>
                  Sair
                </button>
              ) : null}
            </nav>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {scope === "conta" ? <SaveStatus state={saveState} note={saveNote} onRetry={retrySave} /> : null}
                <div className="min-h-0 flex-1 overflow-y-auto pb-24 md:pb-0">{children}</div>
              </div>
              <div className={hasSide ? `${agentOpen ? "fixed inset-0 z-40 flex md:static md:inset-auto" : "hidden md:flex"} md:h-full md:min-h-0 md:w-[340px] md:shrink-0 md:overflow-hidden md:border-l md:border-line` : "hidden"}>
                <div className="flex h-full min-h-0 w-full flex-col bg-canvas">
                  <button type="button" className="shrink-0 px-4 py-3 text-left text-sm text-muted md:hidden" onClick={() => setAgentPath(null)}>
                    Fechar painel
                  </button>
                  <div ref={setSideElement} className="min-h-0 flex-1 overflow-y-auto" />
                </div>
              </div>
            </div>
          </div>
          {hasSide && !agentOpen ? (
            <button
              type="button"
              className="press fixed right-4 bottom-[4.5rem] z-30 inline-flex min-h-12 items-center gap-2 rounded-full bg-violet px-4 text-sm font-medium text-ink md:hidden"
              onClick={() => setAgentPath(pathname)}
            >
              <MessageSquareText className="size-4" aria-hidden="true" />
              {pathname.startsWith("/app/planilha") ? "Agente" : "Resumo do mês"}
            </button>
          ) : null}
          <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-canvas md:hidden" aria-label="App">
            <MobileLink href="/app" label="Início" active={pathname === "/app"} />
            {current ? <MobileLink href={`/app/planilha/${current.id}`} label="Planilha" active={pathname.startsWith("/app/planilha")} /> : null}
            <MobileLink href="/app/educacao" label="Aprender" active={pathname.startsWith("/app/educacao")} />
            <MobileLink href="/app/perfil" label="Perfil" active={pathname.startsWith("/app/perfil") || pathname.startsWith("/app/resetar")} />
            {role === "admin" ? <MobileLink href="/app/admin" label="Admin" active={pathname.startsWith("/app/admin")} /> : null}
          </nav>
        </div>
      </SideContext.Provider>
  );
}

function RailLink({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href} prefetch aria-label={label} title={label} aria-current={active ? "page" : undefined} className="relative flex size-11 items-center justify-center">
      <RailFace active={active}>{children}</RailFace>
    </Link>
  );
}

function RailFace({ active, children }: { active: boolean; children: ReactNode }) {
  const pending = usePendingFlag();
  const on = active || pending;
  return (
    <>
      {pending ? <RouteBar /> : null}
      <span className={`tint flex size-11 items-center justify-center rounded-full ${on ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface"}`}>
        {children}
      </span>
    </>
  );
}

function MobileLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} prefetch aria-current={active ? "page" : undefined} className="flex min-h-14 min-w-0 flex-1 items-center justify-center px-1">
      <MobileFace label={label} active={active} />
    </Link>
  );
}

function MobileFace({ label, active }: { label: string; active: boolean }) {
  const pending = usePendingFlag();
  return (
    <>
      {pending ? <RouteBar /> : null}
      <span className={`text-sm ${active || pending ? "text-ink" : "text-muted"}`}>{label}</span>
    </>
  );
}

function SaveStatus({ state, note, onRetry }: { state: SaveState; note: string | null; onRetry: () => void }) {
  if (state === "ok" || state === "saving") {
    return (
      <p className="shrink-0 px-4 pt-3 text-xs text-muted" role="status">
        {note}
      </p>
    );
  }
  const action = state === "conflict" ? "Recarregar" : state === "expired" ? "Entrar" : "Tentar de novo";
  return (
    <div className="mx-4 mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-coral/40 bg-surface px-4 py-3 text-sm text-ink" role="alert">
      <span>{note}</span>
      <button type="button" className="press min-h-9 rounded-full border border-line px-3 text-sm hover:border-violet-2" onClick={onRetry}>
        {action}
      </button>
    </div>
  );
}

function RouteBar() {
  return <span className="route-bar pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-violet" role="progressbar" aria-valuetext="Abrindo a aba" />;
}

function usePendingFlag(): boolean {
  const { pending } = useLinkStatus();
  return pending;
}
