"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { GraduationCap, House, Table2, UserRound } from "lucide-react";
import { currentMonthly } from "@/lib/finance";
import { useStore } from "@/lib/store";
import { Mark } from "./mark";

const links = [
  { href: "/app", label: "Início" },
  { href: "/app/educacao", label: "Aprender" },
  { href: "/app/perfil", label: "Perfil" },
];

export function AppFrame({
  children,
  side,
}: {
  children: ReactNode;
  side?: ReactNode;
}) {
  const pathname = usePathname();
  const { state } = useStore();
  const current = currentMonthly(state);
  const [agentOpen, setAgentOpen] = useState(false);

  return (
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
        </nav>
        <div className="flex min-w-0 flex-1 flex-col md:flex-row">
          <div className="min-w-0 flex-1 pb-24 md:pb-0">{children}</div>
          {side ? (
            <div className={`${agentOpen ? "fixed inset-0 z-40 flex md:static md:inset-auto" : "hidden md:flex"} md:w-[340px] md:shrink-0 md:border-l md:border-line`}>
              <div className="flex w-full flex-col bg-canvas">
                <button type="button" className="px-4 py-3 text-left text-sm text-muted md:hidden" onClick={() => setAgentOpen(false)}>
                  Fechar painel
                </button>
                <div className="min-h-0 flex-1">{side}</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-canvas/95 backdrop-blur md:hidden" aria-label="App">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="flex min-h-14 flex-1 items-center justify-center text-sm text-muted">
            {link.label}
          </Link>
        ))}
        {current ? (
          <Link href={`/app/planilha/${current.id}`} className="flex min-h-14 flex-1 items-center justify-center text-sm text-muted">
            Planilha
          </Link>
        ) : null}
        {side ? (
          <button type="button" className="min-h-14 flex-1 text-sm text-violet-2" onClick={() => setAgentOpen(true)}>
            Agente
          </button>
        ) : null}
      </nav>
    </div>
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
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`flex size-11 items-center justify-center rounded-full ${active ? "bg-violet text-ink" : "text-muted hover:bg-surface"}`}
    >
      {children}
    </Link>
  );
}
