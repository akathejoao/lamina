"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GraduationCap, House, MessageSquareText, Shield, Table2, UserRound } from "lucide-react";
import { currentMonthly } from "@/lib/finance";
import { FILL_EVENT } from "@/lib/motion";
import { useStore, type SaveState } from "@/lib/store";
import { Mark } from "./mark";
import { ThemeButton } from "./theme-toggle";

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

type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  active: boolean;
};

// Passo vertical do trilho: altura do item (52px) mais o vão (4px). A barra violeta anda por transform.
const RAIL_ITEM = 52;
const RAIL_GAP = 4;

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
  useEffect(() => {
    // Uma frase de exemplo chegou do estado vazio: no celular, abre o painel do agente.
    const open = () => setAgentPath(pathname);
    window.addEventListener(FILL_EVENT, open);
    return () => window.removeEventListener(FILL_EVENT, open);
  }, [pathname]);

  const items: NavItem[] = [
    { href: "/app", label: "Início", Icon: House, active: pathname === "/app" },
    { href: current ? `/app/planilha/${current.id}` : "/app", label: "Planilha", Icon: Table2, active: pathname.startsWith("/app/planilha") },
    { href: "/app/educacao", label: "Aprender", Icon: GraduationCap, active: pathname.startsWith("/app/educacao") },
    { href: "/app/perfil", label: "Perfil", Icon: UserRound, active: pathname.startsWith("/app/perfil") || pathname.startsWith("/app/resetar") },
    ...(role === "admin"
      ? [{ href: "/app/admin", label: "Admin", Icon: Shield, active: pathname.startsWith("/app/admin") } satisfies NavItem]
      : []),
  ];
  const activeIndex = items.findIndex((item) => item.active);
  // Sem planilha no mês, "Planilha" levaria ao início e ficaria sem sentido no menu de baixo.
  const mobileItems = current ? items : items.filter((item) => item.label !== "Planilha");
  const mobileActive = mobileItems.findIndex((item) => item.active);

  return (
    <SideContext.Provider value={sideSlot}>
      <div className="relative flex h-dvh flex-col overflow-hidden bg-canvas text-ink">
        {/* Fica antes do conteúdo no HTML e vai para o fim só pelo layout: o diálogo (dentro do conteúdo) pinta por cima dele. */}
        <nav className="relative order-last flex shrink-0 border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="App">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[-1px] left-0 h-0.5 bg-violet motion-safe:transition-[transform,opacity] motion-safe:duration-200 motion-safe:ease-[var(--ease-out)]"
            style={{
              width: `${100 / mobileItems.length}%`,
              opacity: mobileActive < 0 ? 0 : 1,
              transform: `translateX(${Math.max(0, mobileActive) * 100}%)`,
            }}
          />
          {mobileItems.map((item) => (
            <MobileLink key={item.label} item={item} />
          ))}
        </nav>
        <div className="flex min-h-0 flex-1">
          <nav className="hidden h-full w-16 shrink-0 flex-col items-center border-r border-line py-3 md:flex" aria-label="App">
            <Link
              href={scope === "conta" ? "/app" : "/"}
              aria-label={scope === "conta" ? "Lâmina, início do app" : "Lâmina, página inicial"}
              className="mb-4 flex size-11 items-center justify-center"
            >
              <Mark />
            </Link>
            <div className="relative flex w-full flex-col items-center" style={{ gap: RAIL_GAP }}>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-0 left-0 w-0.5 bg-violet motion-safe:transition-[transform,opacity] motion-safe:duration-200 motion-safe:ease-[var(--ease-out)]"
                style={{
                  height: RAIL_ITEM,
                  opacity: activeIndex < 0 ? 0 : 1,
                  transform: `translateY(${Math.max(0, activeIndex) * (RAIL_ITEM + RAIL_GAP)}px)`,
                }}
              />
              {items.map((item) => (
                <RailLink key={item.label} item={item} />
              ))}
            </div>
            <div className="mt-auto flex flex-col items-center gap-1">
              <ThemeButton />
              {logout ? (
                <button
                  type="button"
                  className="tint min-h-11 w-12 rounded-md text-xs text-muted hover:bg-surface hover:text-ink"
                  onClick={() => void logout()}
                >
                  Sair
                </button>
              ) : null}
            </div>
          </nav>
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
            {hasSide && !agentOpen ? (
              <button
                type="button"
                className="press absolute right-4 bottom-4 inline-flex min-h-12 items-center gap-2 rounded-md bg-violet px-4 text-sm font-medium text-ink md:hidden"
                onClick={() => setAgentPath(pathname)}
              >
                <MessageSquareText className="size-4" aria-hidden="true" />
                {pathname.startsWith("/app/planilha") ? "Agente" : "Resumo do mês"}
              </button>
            ) : null}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {scope === "conta" ? <SaveStatus state={saveState} note={saveNote} onRetry={retrySave} /> : null}
              <main className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${hasSide && !agentOpen ? "pb-20 md:pb-0" : ""}`}>{children}</main>
            </div>
            <div
              className={
                hasSide
                  ? `${agentOpen ? "fixed inset-0 z-40 flex md:static md:inset-auto" : "hidden md:flex"} md:h-full md:min-h-0 md:w-[340px] md:shrink-0 md:overflow-hidden md:border-l md:border-line`
                  : "hidden"
              }
            >
              <div className="flex h-full min-h-0 w-full flex-col bg-canvas pb-[env(safe-area-inset-bottom)] md:pb-0">
                <button
                  type="button"
                  className="tint flex min-h-11 shrink-0 items-center border-b border-line px-4 text-left text-sm text-muted hover:text-ink md:hidden"
                  onClick={() => setAgentPath(null)}
                >
                  Fechar painel
                </button>
                <div ref={setSideElement} className="min-h-0 flex-1 overflow-y-auto" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </SideContext.Provider>
  );
}

function RailLink({ item }: { item: NavItem }) {
  return (
    <Link
      href={item.href}
      prefetch
      aria-label={item.label}
      aria-current={item.active ? "page" : undefined}
      className="press relative flex h-[52px] w-14 flex-col items-center justify-center gap-0.5 rounded-md"
    >
      <RailFace item={item} />
    </Link>
  );
}

function RailFace({ item }: { item: NavItem }) {
  const pending = usePendingFlag();
  const on = item.active || pending;
  return (
    <>
      {pending ? <RouteBar /> : null}
      <item.Icon className={`tint size-5 ${on ? "text-ink" : "text-muted"}`} aria-hidden />
      <span className={`tint text-xs leading-none ${on ? "text-ink" : "text-muted"}`} aria-hidden="true">
        {item.label}
      </span>
    </>
  );
}

function MobileLink({ item }: { item: NavItem }) {
  return (
    <Link
      href={item.href}
      prefetch
      aria-current={item.active ? "page" : undefined}
      className="press flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1"
    >
      <MobileFace item={item} />
    </Link>
  );
}

function MobileFace({ item }: { item: NavItem }) {
  const pending = usePendingFlag();
  const on = item.active || pending;
  return (
    <>
      {pending ? <RouteBar /> : null}
      <item.Icon className={`tint size-5 ${on ? "text-ink" : "text-muted"}`} aria-hidden />
      <span className={`tint truncate text-xs leading-none ${on ? "text-ink" : "text-muted"}`}>{item.label}</span>
    </>
  );
}

function SaveStatus({ state, note, onRetry }: { state: SaveState; note: string | null; onRetry: () => void }) {
  if (state === "ok" || state === "saving") {
    return (
      <p className="shrink-0 px-4 pt-3 text-xs text-muted empty:hidden" role="status">
        {note}
      </p>
    );
  }
  // "Grande demais" e "inválido" falham de novo se tentar outra vez: nada de "Tentar de novo".
  const text =
    state === "toolarge"
      ? "A planilha ficou grande demais para salvar. Apague lançamentos antigos ou arquive meses."
      : state === "invalid"
        ? "Algum dado ficou inválido e não foi salvo. Recarregue a página."
        : note;
  const action = state === "toolarge" ? null : state === "invalid" ? "Recarregar" : state === "conflict" ? "Recarregar" : state === "expired" ? "Entrar" : "Tentar de novo";
  const onAction = state === "invalid" ? () => window.location.reload() : onRetry;
  return (
    <div className="mx-4 mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-coral/40 bg-surface px-4 py-2 text-sm text-ink" role="alert">
      <span className="min-w-0">{text}</span>
      {action ? (
        <button type="button" className="press min-h-10 rounded-md border border-line px-4 text-sm hover:border-violet-2" onClick={onAction}>
          {action}
        </button>
      ) : null}
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
