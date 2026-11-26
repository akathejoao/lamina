"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Button, fieldClass } from "@/components/ui";

type Access = "cortesia" | "ativo" | "bloqueado";

type Account = {
  name: string;
  email: string;
  role: "admin" | "user";
  access: Access;
  note: string;
  createdAt: string;
  consentAt: string;
  termsVersion: string;
  ledgerUpdatedAt: string | null;
};

const accessLabel: Record<Access, string> = {
  cortesia: "Cortesia",
  ativo: "Ativo",
  bloqueado: "Bloqueado",
};

export default function AdminPage() {
  const { role, email } = useStore();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { access: Access; note: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  const load = () => {
    fetch("/api/admin/accounts")
      .then(async (response) => {
        const body = (await response.json()) as { accounts?: Account[]; error?: string };
        if (!response.ok) {
          setError(body.error ?? "Não foi possível listar as contas.");
          return;
        }
        const next = body.accounts ?? [];
        setAccounts(next);
        setLoadedAt(Date.now());
        setDrafts(
          Object.fromEntries(next.map((account) => [account.email, { access: account.access, note: account.note }])),
        );
      })
      .catch(() => setError("Sem conexão."));
  };

  useEffect(() => {
    if (role === "admin") load();
  }, [role]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (accounts ?? []).filter((account) => !needle || `${account.name} ${account.email}`.toLowerCase().includes(needle));
  }, [accounts, query]);

  const counts = useMemo(() => {
    const list = accounts ?? [];
    const weekAgo = (loadedAt ?? 0) - 7 * 24 * 60 * 60 * 1000;
    return {
      total: list.length,
      cortesia: list.filter((account) => account.access === "cortesia").length,
      ativo: list.filter((account) => account.access === "ativo").length,
      bloqueado: list.filter((account) => account.access === "bloqueado").length,
      recent: list.filter((account) => new Date(account.createdAt).getTime() >= weekAgo).length,
    };
  }, [accounts, loadedAt]);

  const save = async (accountEmail: string) => {
    const draft = drafts[accountEmail];
    if (!draft) return;
    setSaving(accountEmail);
    setError(null);
    const response = await fetch("/api/admin/accounts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: accountEmail, access: draft.access, note: draft.note }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setSaving(null);
    if (!response.ok) {
      setError(body?.error ?? "Não salvou o acesso.");
      return;
    }
    load();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="display text-4xl sm:text-5xl">Quem entra na Lâmina</h1>
      {role !== "admin" ? (
        <p className="sheet-grid mt-6 rounded-lg border border-line p-6 text-sm text-muted">Esta aba é só da conta administradora.</p>
      ) : (
        <>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            Você vê quem criou conta e decide se o acesso está em cortesia, ativo ou bloqueado. Isso é a base para vender o uso depois. Os lançamentos de cada pessoa continuam cifrados com a senha dela. Esta tela não abre planilha nenhuma.
          </p>
          <p className="mt-2 text-sm text-violet-2 [overflow-wrap:anywhere]">Administrador: {email}</p>
          <dl className="mt-5 grid grid-cols-1 divide-y divide-line border-y border-line sm:grid-cols-5 sm:divide-x sm:divide-y-0">
            <Stat label="Contas" value={String(counts.total)} />
            <Stat label="Novas em 7 dias" value={String(counts.recent)} />
            <Stat label="Cortesia" value={String(counts.cortesia)} />
            <Stat label="Ativos" value={String(counts.ativo)} />
            <Stat label="Bloqueados" value={String(counts.bloqueado)} />
          </dl>
          <label className="mt-6 block max-w-sm text-sm text-muted">
            <span className="mb-1.5 block">Buscar</span>
            <input className={fieldClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome ou e-mail" />
          </label>
          {error ? (
            <p className="mt-4 text-sm text-coral" role="alert">
              {error}
            </p>
          ) : null}
          {accounts === null && !error ? <p className="mt-4 text-sm text-muted">Carregando contas…</p> : null}
          {accounts && visible.length === 0 ? <p className="sheet-grid mt-4 rounded-lg border border-line px-4 py-6 text-sm text-muted">Nenhuma conta com esse filtro.</p> : null}
          {visible.length > 0 ? (
            <div className="blade mt-4 rounded-lg border border-line bg-surface">
              <div className="col-label hidden grid-cols-[minmax(0,1.2fr)_10rem_minmax(0,1fr)_6rem] gap-x-3 border-b border-line px-4 py-2 uppercase md:grid">
                <span>Conta</span>
                <span>Acesso</span>
                <span>Nota interna</span>
                <span className="sr-only">Ações</span>
              </div>
              <ul className="ruled">
                {visible.map((account) => {
                  const draft = drafts[account.email] ?? { access: account.access, note: account.note };
                  return (
                    <li key={account.email} className="grid gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_10rem_minmax(0,1fr)_6rem] md:items-center">
                      <div className="min-w-0">
                        <p className="[overflow-wrap:anywhere]">
                          {account.name}
                          {account.role === "admin" ? <span className="ml-2 text-xs text-violet-2">Administrador</span> : null}
                        </p>
                        <p className="text-sm text-muted [overflow-wrap:anywhere]">{account.email}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">
                          Cadastro em {formatWhen(account.createdAt)}, termos {account.termsVersion}
                          {account.ledgerUpdatedAt ? `, planilha mexida em ${formatWhen(account.ledgerUpdatedAt)}` : ""}. Agora: {accessLabel[account.access]}.
                        </p>
                      </div>
                      <select
                        className={fieldClass}
                        aria-label={`Acesso de ${account.email}`}
                        value={draft.access}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [account.email]: { ...draft, access: event.target.value as Access },
                          }))
                        }
                      >
                        <option value="cortesia">Cortesia</option>
                        <option value="ativo">Ativo</option>
                        <option value="bloqueado">Bloqueado</option>
                      </select>
                      <input
                        className={fieldClass}
                        aria-label={`Nota sobre ${account.email}`}
                        value={draft.note}
                        maxLength={280}
                        placeholder="Nota interna, só você vê"
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [account.email]: { ...draft, note: event.target.value },
                          }))
                        }
                      />
                      <Button type="button" disabled={saving === account.email} onClick={() => void save(account.email)}>
                        {saving === account.email ? "Salvando…" : "Salvar"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 py-2.5 sm:block sm:px-4 sm:py-3 sm:first:pl-0">
      <dt className="col-label uppercase">{label}</dt>
      <dd className="num text-lg sm:mt-1 sm:text-2xl">{value}</dd>
    </div>
  );
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
