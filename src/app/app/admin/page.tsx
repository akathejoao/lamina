"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fieldClass } from "@/components/ui";

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
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
        <p className="kicker">Administração</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Quem entra na Lâmina</h1>
        {role !== "admin" ? (
          <p className="mt-4 text-sm text-muted">Esta aba é só da conta administradora.</p>
        ) : (
          <>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
              Você vê quem criou conta e decide se o acesso está em cortesia, ativo ou bloqueado. Isso é a base para vender o uso depois. Os lançamentos de cada pessoa continuam cifrados com a senha dela. Esta tela não abre planilha nenhuma.
            </p>
            <p className="mt-2 text-sm text-violet-2">Administrador: {email}</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Contas" value={String(counts.total)} />
              <Stat label="Novas em 7 dias" value={String(counts.recent)} />
              <Stat label="Cortesia" value={String(counts.cortesia)} />
              <Stat label="Ativos" value={String(counts.ativo)} />
              <Stat label="Bloqueados" value={String(counts.bloqueado)} />
            </div>
            <label className="mt-6 block text-sm text-muted">
              Buscar
              <input className={`${fieldClass} mt-1`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome ou e-mail" />
            </label>
            {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}
            {accounts === null && !error ? <p className="mt-4 text-sm text-muted">Carregando contas…</p> : null}
            {accounts && visible.length === 0 ? <p className="mt-4 text-sm text-muted">Nenhuma conta com esse filtro.</p> : null}
            <ul className="mt-4 space-y-3">
              {visible.map((account) => {
                const draft = drafts[account.email] ?? { access: account.access, note: account.note };
                return (
                  <li key={account.email} className="rounded-2xl border border-line bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg">{account.name}</p>
                        <p className="text-sm text-muted">{account.email}</p>
                      </div>
                      <p className="text-xs text-violet-2">{account.role === "admin" ? "Administrador" : "Conta"}</p>
                    </div>
                    <p className="mt-2 text-xs text-faint">
                      Cadastro {formatWhen(account.createdAt)} · termos {account.termsVersion}
                      {account.ledgerUpdatedAt ? ` · planilha mexida ${formatWhen(account.ledgerUpdatedAt)}` : ""}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto]">
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
                      <button
                        type="button"
                        className="min-h-11 rounded-full bg-violet px-4 text-sm"
                        disabled={saving === account.email}
                        onClick={() => void save(account.email)}
                      >
                        {saving === account.email ? "Salvando…" : "Salvar"}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-faint">Agora: {accessLabel[account.access]}</p>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-3">
      <p className="kicker">{label}</p>
      <p className="num mt-2 text-2xl">{value}</p>
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
