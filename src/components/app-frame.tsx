"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GraduationCap, House, RotateCcw, Shield, Table2, UserRound } from "lucide-react";
import { currentMonthly } from "@/lib/finance";
import { useStore } from "@/lib/store";
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
  const { state, logout, saveNote, scope, role } = useStore();
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
        <div className="min-h-dvh bg-canvas text-ink">
          <div className="flex min-h-dvh">
            <nav className="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col items-center gap-3 border-r border-line py-4 md:flex" aria-label="App">
              <Link href="/" aria-label="Lâmina, página inicial" className="mb-4">
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
              <RailLink href="/app/resetar" label="Resetar" active={pathname.startsWith("/app/resetar")}>
                <RotateCcw className="size-5" />
              </RailLink>
              {role === "admin" ? (
                <RailLink href="/app/admin" label="Administração" active={pathname.startsWith("/app/admin")}>
                  <Shield className="size-5" />
                </RailLink>
              ) : null}
              {logout ? (
                <button type="button" className="mt-auto text-[11px] text-faint hover:text-ink" onClick={() => void logout()}>
                  Sair
                </button>
              ) : null}
            </nav>
            <div className="flex min-w-0 flex-1 flex-col md:flex-row">
              <div className="min-w-0 flex-1 pb-24 md:pb-0">
                {scope === "conta" ? <p className="px-4 pt-3 text-xs text-faint">{saveNote}</p> : null}
                {children}
              </div>
              <div className={hasSide ? `${agentOpen ? "fixed inset-0 z-40 flex md:static md:inset-auto" : "hidden md:flex"} md:max-h-dvh md:w-[340px] md:shrink-0 md:overflow-y-auto md:border-l md:border-line` : "hidden"}>
                <div className="flex w-full flex-col bg-canvas">
                  <button type="button" className="px-4 py-3 text-left text-sm text-muted md:hidden" onClick={() => setAgentPath(null)}>
                    Fechar painel
                  </button>
                  <div ref={setSideElement} className="min-h-0 flex-1" />
                </div>
              </div>
            </div>
          </div>
          <nav className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-line bg-canvas/95 backdrop-blur md:hidden" aria-label="App">
            <MobileLink href="/app" label="Início" active={pathname === "/app"} />
            <MobileLink href="/app/educacao" label="Aprender" active={pathname.startsWith("/app/educacao")} />
            <MobileLink href="/app/perfil" label="Perfil" active={pathname.startsWith("/app/perfil")} />
            {current ? <MobileLink href={`/app/planilha/${current.id}`} label="Planilha" active={pathname.startsWith("/app/planilha")} /> : null}
            <MobileLink href="/app/resetar" label="Resetar" active={pathname.startsWith("/app/resetar")} />
            {role === "admin" ? <MobileLink href="/app/admin" label="Admin" active={pathname.startsWith("/app/admin")} /> : null}
            {hasSide ? (
              <button type="button" className="min-h-14 shrink-0 px-3 text-sm text-violet-2" onClick={() => setAgentPath(pathname)}>
                Painel
              </button>
            ) : null}
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
      <span className={`tint flex size-11 items-center justify-center rounded-full ${on ? "bg-violet text-ink" : "text-muted hover:bg-surface"}`}>
        {children}
      </span>
    </>
  );
}

function MobileLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} prefetch aria-current={active ? "page" : undefined} className="flex min-h-14 min-w-[4.5rem] flex-1 items-center justify-center px-1">
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

function RouteBar() {
  return <span className="route-bar pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-violet" role="progressbar" aria-valuetext="Abrindo a aba" />;
}

function usePendingFlag(): boolean {
  const { pending } = useLinkStatus();
  return pending;
}
