"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { interpret } from "./agent";
import { addEntryTo, duplicateMonthIn, removeEntries, restoreEntryTo, updateGoalIn, type DraftEntry } from "./finance";
import { applyProfilePatch, freshLedger, scrubLedger } from "./fresh";
import { NOVEMBER, seedState } from "./seed";
import { sheetFromDraft, type SheetDraft } from "./sheets";
import { monthKey, todayISO, uid } from "./money";
import type { Entry, LedgerState, Profile } from "./types";

// v2: a demonstração agora anda com o calendário. Uma demo guardada de outro mês volta ao exemplo novo.
const KEY = "lamina-ledger-v2";

export type SaveState = "ok" | "saving" | "error" | "conflict" | "expired" | "toolarge" | "invalid";

type Store = {
  state: LedgerState;
  scope: "demo" | "conta";
  email: string | null;
  role: "admin" | "user" | null;
  access: "cortesia" | "ativo" | "bloqueado" | null;
  consentAt: string | null;
  saveNote: string | null;
  saveState: SaveState;
  retrySave: () => void;
  logout: (() => Promise<void>) | null;
  addEntry: (sheetId: string, draft: DraftEntry) => void;
  removeEntry: (id: string) => void;
  restoreEntry: (entry: Entry) => void;
  createSheet: (draft: SheetDraft) => string;
  updateSheet: (id: string, draft: SheetDraft) => void;
  archiveSheet: (id: string) => void;
  duplicateMonth: (id: string) => string | null;
  clearSheet: (id: string) => void;
  updateGoal: (id: string, patch: { name?: string; targetCents?: number; savedCents?: number; note?: string }) => void;
  importRows: (sheetId: string, rows: DraftEntry[]) => void;
  send: (sheetId: string, text: string) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  reset: () => void;
};

const listeners = new Set<() => void>();
let snapshot: LedgerState = seedState;
let hydrated = false;

function readStorage(): LedgerState {
  if (typeof window === "undefined") return seedState;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seedState;
    const parsed = JSON.parse(raw) as LedgerState;
    const current = monthKey(todayISO());
    const upToDate =
      Array.isArray(parsed.sheets) && parsed.sheets.some((sheet) => sheet.kind === "mensal" && sheet.month === current);
    if (upToDate && parsed.entries && parsed.profile) return parsed;
  } catch {
    /* keep the example ledger */
  }
  return seedState;
}

function getSnapshot(): LedgerState {
  if (!hydrated) {
    snapshot = readStorage();
    hydrated = true;
  }
  return snapshot;
}

function getServerSnapshot(): LedgerState {
  return seedState;
}

function emit(next: LedgerState) {
  snapshot = next;
  hydrated = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode can refuse storage */
  }
  listeners.forEach((listener) => listener());
}

function update(recipe: (current: LedgerState) => LedgerState) {
  emit(recipe(getSnapshot()));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    snapshot = readStorage();
    hydrated = true;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// Uma frase do chat vira, de uma vez, a mensagem, o desfazer e os lançamentos.
function runSend(current: LedgerState, sheetId: string, text: string): LedgerState {
  const sheet = current.sheets.find((item) => item.id === sheetId);
  if (!sheet) return current;
  const outcome = interpret(text, current, sheet);
  let next: LedgerState = {
    ...current,
    messages: [
      ...current.messages,
      { id: uid(), sheetId, role: "user", text, at: new Date().toISOString() },
      { id: uid(), sheetId, role: "agent", text: outcome.reply, at: new Date().toISOString() },
    ],
  };
  if (outcome.undoEntryId) next = removeEntries(next, (entry) => entry.id === outcome.undoEntryId);
  if (outcome.entry) next = addEntryTo(next, sheetId, { ...outcome.entry, source: "agente" });
  if (outcome.csv) next = outcome.csv.reduce((acc, row) => addEntryTo(acc, sheetId, { ...row, source: "csv" }), next);
  return next;
}

const StoreContext = createContext<Store | null>(null);
const AccountContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const api = useMemo<Store>(
    () => ({
      state,
      scope: "demo",
      email: null,
      role: null,
      access: null,
      consentAt: null,
      saveNote: "Demonstração neste navegador",
      saveState: "ok",
      retrySave: () => undefined,
      logout: null,
      addEntry: (sheetId, draft) => update((current) => addEntryTo(current, sheetId, { source: "manual", ...draft })),
      removeEntry: (id) => update((current) => removeEntries(current, (entry) => entry.id === id)),
      restoreEntry: (entry) => update((current) => restoreEntryTo(current, entry)),
      createSheet: (draft) => {
        const id = uid();
        update((current) => ({ ...current, sheets: [...current.sheets, sheetFromDraft(id, draft)] }));
        return id;
      },
      updateSheet: (id, draft) =>
        update((current) => ({
          ...current,
          sheets: current.sheets.map((sheet) => (sheet.id === id ? sheetFromDraft(id, draft, sheet.archived) : sheet)),
        })),
      archiveSheet: (id) =>
        update((current) => ({
          ...current,
          sheets: current.sheets.map((sheet) => (sheet.id === id ? { ...sheet, archived: true } : sheet)),
        })),
      duplicateMonth: (id) => {
        const result = duplicateMonthIn(getSnapshot(), id);
        if (!result) return null;
        emit(result.state);
        return result.id;
      },
      clearSheet: (id) => update((current) => removeEntries(current, (entry) => entry.sheetId === id)),
      updateGoal: (id, patch) => update((current) => updateGoalIn(current, id, patch)),
      importRows: (sheetId, rows) =>
        update((current) => rows.reduce((next, row) => addEntryTo(next, sheetId, { source: "csv", ...row }), current)),
      send: (sheetId, text) => update((current) => runSend(current, sheetId, text)),
      updateProfile: (patch) => update((current) => applyProfilePatch(current, patch)),
      reset: () => emit(seedState),
    }),
    [state],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const account = useContext(AccountContext);
  const store = useContext(StoreContext);
  const chosen = account ?? store;
  if (!chosen) throw new Error("useStore precisa do StoreProvider");
  return chosen;
}

export { NOVEMBER };

type AccountInfo = {
  email: string;
  consentAt: string;
  termsVersion: string;
  role: "admin" | "user";
  access: "cortesia" | "ativo" | "bloqueado";
};

let accountLedger: LedgerState | null = null;
let accountVersion = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let inflight = false;
let dirty = false;
let lastSave: SaveState = "ok";
let generation = 0;

const SAVE_NOTE: Record<SaveState, string> = {
  ok: "Salva na conta",
  saving: "Salvando…",
  error: "Não salvou. Sem conexão ou servidor fora do ar.",
  conflict: "A planilha mudou em outro aparelho. Recarregue para ver a versão mais nova.",
  expired: "A sessão terminou. Entre de novo para salvar.",
  toolarge: "A planilha ficou grande demais para salvar. Apague lançamentos ou mensagens antigos.",
  invalid: "Algum dado ficou inválido. Recarregue a página; o que deu errado não foi salvo.",
};

// Um salvamento por vez, sempre com a versão que o servidor devolveu por último.
async function runSave(report: (state: SaveState) => void, onBlocked: () => void): Promise<void> {
  const onState = (state: SaveState) => {
    lastSave = state;
    report(state);
  };
  if (!accountLedger) return;
  if (inflight) {
    dirty = true;
    return;
  }
  inflight = true;
  dirty = false;
  try {
    const response = await fetch("/api/ledger", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ledger: accountLedger, version: accountVersion }),
    });
    const body = (await response.json().catch(() => null)) as { version?: number; blocked?: boolean } | null;
    if (response.ok && typeof body?.version === "number") {
      accountVersion = body.version;
      onState(dirty ? "saving" : "ok");
    } else if (response.status === 409) {
      dirty = false;
      onState("conflict");
    } else if (response.status === 413) {
      dirty = false;
      onState("toolarge");
    } else if (response.status === 400) {
      dirty = false;
      onState("invalid");
    } else if (response.status === 401) {
      dirty = false;
      onState("expired");
    } else if (response.status === 403 && body?.blocked) {
      dirty = false;
      onBlocked();
    } else {
      onState("error");
    }
  } catch {
    onState("error");
  } finally {
    inflight = false;
  }
  if (dirty) await runSave(report, onBlocked);
}

// Salva na hora o que estiver pendente (atraso de 400 ms, gravação em curso ou
// mudança que chegou durante ela) e espera terminar. Usado antes de sair e quando
// o app deixa de existir na tela, para nenhuma edição, como a foto do perfil, se perder.
async function drainSaves(report: (state: SaveState) => void, onBlocked: () => void): Promise<SaveState> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    dirty = true;
  }
  for (let i = 0; i < 100 && (inflight || dirty); i += 1) {
    if (!inflight && dirty) await runSave(report, onBlocked);
    else await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return lastSave;
}

export function AccountStoreProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ledger, setLedger] = useState<LedgerState | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [loadNote, setLoadNote] = useState("Abrindo a planilha cifrada…");
  const [saveState, setSaveState] = useState<SaveState>("ok");

  const logout = useCallback(async () => {
    const saved = await drainSaves(setSaveState, () => setBlocked(true));
    if (saved !== "ok" && !window.confirm("A última mudança ainda não foi salva na conta. Sair mesmo assim?")) return;
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    generation += 1;
    accountLedger = null;
    router.push("/");
  }, [router]);

  useEffect(() => {
    let live = true;
    fetch("/api/ledger")
      .then(async (response) => {
        if (!live) return;
        if (response.status === 401) {
          router.push("/entrar");
          return;
        }
        if (response.status === 403) {
          const body = (await response.json().catch(() => null)) as { blocked?: boolean } | null;
          if (body?.blocked) {
            setBlocked(true);
            return;
          }
        }
        if (!response.ok) {
          setLoadNote("Não foi possível abrir a planilha. Recarregue a página.");
          return;
        }
        const body = (await response.json()) as { ledger: LedgerState; version: number; account: AccountInfo };
        if (body.account.access === "bloqueado") {
          setBlocked(true);
          return;
        }
        const clean = scrubLedger(body.ledger);
        generation += 1;
        accountLedger = clean;
        accountVersion = body.version;
        setLedger(clean);
        setAccount(body.account);
        setSaveState("ok");
      })
      .catch(() => {
        if (live) setLoadNote("Sem conexão para abrir a planilha.");
      });
    return () => {
      live = false;
      const mine = generation;
      // Sair do app sem passar por Sair (um link para fora, por exemplo) não pode
      // descartar a gravação pendente: salva primeiro e só então esquece a planilha.
      void drainSaves(() => undefined, () => undefined).then(() => {
        if (generation === mine) accountLedger = null;
      });
    };
  }, [router]);

  const flush = useCallback(() => runSave(setSaveState, () => setBlocked(true)), []);

  const write = useCallback(
    (recipe: (current: LedgerState) => LedgerState) => {
      if (!accountLedger) return;
      const next = scrubLedger(recipe(accountLedger));
      accountLedger = next;
      setLedger(next);
      setSaveState("saving");
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => void flush(), 400);
    },
    [flush],
  );

  // Quem fecha a aba logo depois de editar não perde a última mudança.
  useEffect(() => {
    const onHide = () => {
      if (!saveTimer || !accountLedger) return;
      clearTimeout(saveTimer);
      saveTimer = null;
      void flush();
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flush]);

  const retrySave = useCallback(() => {
    if (saveState === "conflict") {
      window.location.reload();
      return;
    }
    if (saveState === "expired") {
      router.push("/entrar");
      return;
    }
    setSaveState("saving");
    void flush();
  }, [flush, router, saveState]);

  const saveNote = SAVE_NOTE[saveState];

  const api = useMemo<Store | null>(() => {
    if (!ledger || !account) return null;
    return {
      state: ledger,
      scope: "conta",
      email: account.email,
      role: account.role,
      access: account.access,
      consentAt: account.consentAt,
      saveNote,
      saveState,
      retrySave,
      logout,
      addEntry: (sheetId, draft) => write((current) => addEntryTo(current, sheetId, { source: "manual", ...draft })),
      removeEntry: (id) => write((current) => removeEntries(current, (entry) => entry.id === id)),
      restoreEntry: (entry) => write((current) => restoreEntryTo(current, entry)),
      createSheet: (draft) => {
        const id = uid();
        write((current) => ({ ...current, sheets: [...current.sheets, sheetFromDraft(id, draft)] }));
        return id;
      },
      updateSheet: (id, draft) =>
        write((current) => ({
          ...current,
          sheets: current.sheets.map((sheet) => (sheet.id === id ? sheetFromDraft(id, draft, sheet.archived) : sheet)),
        })),
      archiveSheet: (id) =>
        write((current) => ({
          ...current,
          sheets: current.sheets.map((sheet) => (sheet.id === id ? { ...sheet, archived: true } : sheet)),
        })),
      duplicateMonth: (id) => {
        const preview = duplicateMonthIn(ledger, id);
        if (!preview) return null;
        const newId = preview.id;
        write((latest) => {
          let first = true;
          const result = duplicateMonthIn(latest, id, () => {
            if (first) {
              first = false;
              return newId;
            }
            return uid();
          });
          return result ? result.state : latest;
        });
        return newId;
      },
      clearSheet: (id) => write((current) => removeEntries(current, (entry) => entry.sheetId === id)),
      updateGoal: (id, patch) => write((current) => updateGoalIn(current, id, patch)),
      importRows: (sheetId, rows) =>
        write((current) => rows.reduce((next, row) => addEntryTo(next, sheetId, { source: "csv", ...row }), current)),
      send: (sheetId, text) => write((current) => runSend(current, sheetId, text)),
      updateProfile: (patch) => write((current) => applyProfilePatch(current, patch)),
      reset: () => write((current) => freshLedger(current.profile.name)),
    };
  }, [account, ledger, logout, retrySave, saveNote, saveState, write]);

  if (blocked) return <BlockedAccess logout={logout} />;
  if (!api) {
    return (
      <p className="px-6 py-16 text-sm text-muted" role="status">
        {loadNote}
      </p>
    );
  }
  return <AccountContext.Provider value={api}>{children}</AccountContext.Provider>;
}

function BlockedAccess({ logout }: { logout: () => Promise<void> }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const erase = async (event: FormEvent) => {
    event.preventDefault();
    if (!window.confirm("Apagar a conta e a planilha cifrada? Isso não pode ser desfeito.")) return;
    setPending(true);
    setNote(null);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (response.ok) {
        router.push("/");
        return;
      }
      setNote(body?.error ?? "Não apagou a conta.");
    } catch {
      setNote("Sem conexão. Tente de novo.");
    } finally {
      setPending(false);
    }
  };

  const download = async () => {
    setPending(true);
    setNote(null);
    try {
      const response = await fetch("/api/account/export", { cache: "no-store" });
      if (!response.ok) {
        setNote("Não baixou os dados. Tente de novo.");
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "lamina-meus-dados.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setNote("Sem conexão. Tente de novo.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col justify-center overflow-y-auto px-6">
      <h1 className="display text-4xl">Esta conta não entra na planilha agora.</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        O administrador marcou o acesso como bloqueado. Quando ele voltar para cortesia ou ativo, os lançamentos continuam aqui, cifrados.
      </p>
      <button type="button" disabled={pending} onClick={() => void download()} className="press mt-6 min-h-11 self-start rounded-md border border-line px-4 text-sm text-ink disabled:opacity-40">
        Baixar meus dados
      </button>
      <form onSubmit={erase} className="mt-8 grid gap-2 border-t border-line pt-6">
        <label className="text-sm text-muted" htmlFor="blocked-erase">
          Se preferir, apague a conta e a planilha. Confirme com a senha.
        </label>
        <input
          id="blocked-erase"
          className="min-h-11 w-full rounded-md border border-field bg-canvas px-3 text-ink focus-visible:border-violet-2"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button type="submit" disabled={pending} className="press min-h-11 rounded-md border border-coral/50 px-4 text-sm text-coral disabled:opacity-40">
          Apagar a conta
        </button>
        {note ? (
          <p className="text-sm text-coral" role="alert">
            {note}
          </p>
        ) : null}
      </form>
      <button type="button" className="mt-6 min-h-11 self-start text-sm text-violet-2" onClick={() => void logout()}>
        Sair
      </button>
    </main>
  );
}
