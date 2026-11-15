"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { interpret } from "./agent";
import { NOVEMBER, seedState } from "./seed";
import { uid } from "./money";
import type { Entry, EntryType, LedgerState, Profile, Sheet, SheetKind } from "./types";

const KEY = "lamina-ledger-v1";

type DraftEntry = {
  type: EntryType;
  title: string;
  category: string;
  cents: number;
  date: string;
  dueDay?: number | null;
  installment?: { current: number; total: number } | null;
};

type Store = {
  state: LedgerState;
  scope: "demo" | "conta";
  email: string | null;
  consentAt: string | null;
  saveNote: string | null;
  logout: (() => Promise<void>) | null;
  addEntry: (sheetId: string, draft: DraftEntry) => void;
  removeEntry: (id: string) => void;
  createSheet: (draft: {
    name: string;
    kind: SheetKind;
    month: string | null;
    deadline: string | null;
    targetCents: number | null;
  }) => string;
  archiveSheet: (id: string) => void;
  duplicateMonth: (id: string) => string | null;
  clearSheet: (id: string) => void;
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
    if (parsed.sheets && parsed.entries && parsed.profile) return parsed;
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

function pushEntry(current: LedgerState, sheetId: string, draft: DraftEntry): LedgerState {
  const item: Entry = {
    id: uid(),
    sheetId,
    type: draft.type,
    title: draft.title,
    category: draft.category,
    cents: draft.cents,
    date: draft.date,
    dueDay: draft.dueDay ?? null,
    installment: draft.installment ?? null,
  };
  let goals = current.goals;
  if (draft.type === "investimento" && /reserva/i.test(draft.category)) {
    goals = goals.map((goal) =>
      goal.id === "goal-reserva" ? { ...goal, savedCents: goal.savedCents + draft.cents } : goal,
    );
  }
  if (draft.type === "investimento" && /viagem|jap[aã]o/i.test(`${draft.category} ${draft.title}`)) {
    goals = goals.map((goal) =>
      goal.id === "goal-jp" ? { ...goal, savedCents: goal.savedCents + draft.cents } : goal,
    );
  }
  return { ...current, entries: [...current.entries, item], goals };
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
      consentAt: null,
      saveNote: "Demonstração neste navegador",
      logout: null,
      addEntry: (sheetId, draft) => update((current) => pushEntry(current, sheetId, draft)),
      removeEntry: (id) =>
        update((current) => ({
          ...current,
          entries: current.entries.filter((entry) => entry.id !== id),
        })),
      createSheet: (draft) => {
        const id = uid();
        const sheet: Sheet = {
          id,
          name: draft.name,
          kind: draft.kind,
          month: draft.month,
          deadline: draft.deadline,
          targetCents: draft.targetCents,
          archived: false,
        };
        update((current) => ({ ...current, sheets: [...current.sheets, sheet] }));
        return id;
      },
      archiveSheet: (id) =>
        update((current) => ({
          ...current,
          sheets: current.sheets.map((sheet) => (sheet.id === id ? { ...sheet, archived: true } : sheet)),
        })),
      duplicateMonth: (id) => {
        const current = getSnapshot();
        const source = current.sheets.find((sheet) => sheet.id === id);
        if (!source?.month) return null;
        const [year, month] = source.month.split("-").map(Number);
        const next = new Date(Date.UTC(year, month, 1));
        const key = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
        if (current.sheets.some((sheet) => sheet.month === key)) return null;
        const newId = uid();
        const copy = current.entries.filter(
          (entry) =>
            entry.sheetId === id &&
            (entry.type === "fixo" || entry.type === "assinatura" || entry.category === "Salário"),
        );
        update((latest) => ({
          ...latest,
          sheets: [
            ...latest.sheets,
            {
              id: newId,
              name: monthName(key),
              kind: "mensal",
              month: key,
              deadline: null,
              targetCents: null,
              archived: false,
            },
          ],
          entries: [
            ...latest.entries,
            ...copy.map((entry) => ({
              ...entry,
              id: uid(),
              sheetId: newId,
              date: `${key}-${entry.date.slice(8, 10)}`,
            })),
          ],
        }));
        return newId;
      },
      clearSheet: (id) =>
        update((current) => ({
          ...current,
          entries: current.entries.filter((entry) => entry.sheetId !== id),
        })),
      importRows: (sheetId, rows) =>
        update((current) => rows.reduce((next, row) => pushEntry(next, sheetId, row), current)),
      send: (sheetId, text) =>
        update((current) => {
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
          if (outcome.entry) next = pushEntry(next, sheetId, outcome.entry);
          if (outcome.csv) next = outcome.csv.reduce((acc, row) => pushEntry(acc, sheetId, row), next);
          return next;
        }),
      updateProfile: (patch) =>
        update((current) => ({ ...current, profile: { ...current.profile, ...patch } })),
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

type AccountInfo = { email: string; consentAt: string; termsVersion: string };

let accountLedger: LedgerState | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function AccountStoreProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ledger, setLedger] = useState<LedgerState | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [saveNote, setSaveNote] = useState("Abrindo a planilha cifrada…");

  useEffect(() => {
    let live = true;
    fetch("/api/ledger")
      .then(async (response) => {
        if (!live) return;
        if (response.status === 401) {
          router.push("/entrar");
          return;
        }
        if (!response.ok) {
          setSaveNote("Não foi possível abrir a planilha.");
          return;
        }
        const body = (await response.json()) as { ledger: LedgerState; account: AccountInfo };
        accountLedger = body.ledger;
        setLedger(body.ledger);
        setAccount(body.account);
        setSaveNote("Salva na conta");
      })
      .catch(() => {
        if (live) setSaveNote("Sem conexão para abrir a planilha.");
      });
    return () => {
      live = false;
      accountLedger = null;
    };
  }, [router]);

  const write = useCallback((recipe: (current: LedgerState) => LedgerState) => {
    if (!accountLedger) return;
    const next = recipe(accountLedger);
    accountLedger = next;
    setLedger(next);
    setSaveNote("Salvando…");
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      fetch("/api/ledger", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      })
        .then((response) => setSaveNote(response.ok ? "Salva na conta" : "Não salvou. Tente de novo."))
        .catch(() => setSaveNote("Não salvou. Sem conexão."));
    }, 400);
  }, []);

  const api = useMemo<Store | null>(() => {
    if (!ledger || !account) return null;
    return {
      state: ledger,
      scope: "conta",
      email: account.email,
      consentAt: account.consentAt,
      saveNote,
      logout: async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      },
      addEntry: (sheetId, draft) => write((current) => pushEntry(current, sheetId, draft)),
      removeEntry: (id) => write((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== id) })),
      createSheet: (draft) => {
        const id = uid();
        write((current) => ({
          ...current,
          sheets: [
            ...current.sheets,
            {
              id,
              name: draft.name,
              kind: draft.kind,
              month: draft.month,
              deadline: draft.deadline,
              targetCents: draft.targetCents,
              archived: false,
            },
          ],
        }));
        return id;
      },
      archiveSheet: (id) =>
        write((current) => ({
          ...current,
          sheets: current.sheets.map((sheet) => (sheet.id === id ? { ...sheet, archived: true } : sheet)),
        })),
      duplicateMonth: (id) => {
        const source = ledger.sheets.find((sheet) => sheet.id === id);
        if (!source?.month) return null;
        const [year, month] = source.month.split("-").map(Number);
        const next = new Date(Date.UTC(year, month, 1));
        const key = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
        if (ledger.sheets.some((sheet) => sheet.month === key)) return null;
        const newId = uid();
        const copy = ledger.entries.filter(
          (entry) =>
            entry.sheetId === id &&
            (entry.type === "fixo" || entry.type === "assinatura" || entry.category === "Salário"),
        );
        write((latest) => ({
          ...latest,
          sheets: [
            ...latest.sheets,
            {
              id: newId,
              name: monthName(key),
              kind: "mensal",
              month: key,
              deadline: null,
              targetCents: null,
              archived: false,
            },
          ],
          entries: [
            ...latest.entries,
            ...copy.map((entry) => ({
              ...entry,
              id: uid(),
              sheetId: newId,
              date: `${key}-${entry.date.slice(8, 10)}`,
            })),
          ],
        }));
        return newId;
      },
      clearSheet: (id) => write((current) => ({ ...current, entries: current.entries.filter((entry) => entry.sheetId !== id) })),
      importRows: (sheetId, rows) => write((current) => rows.reduce((next, row) => pushEntry(next, sheetId, row), current)),
      send: (sheetId, text) =>
        write((current) => {
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
          if (outcome.entry) next = pushEntry(next, sheetId, outcome.entry);
          if (outcome.csv) next = outcome.csv.reduce((acc, row) => pushEntry(acc, sheetId, row), next);
          return next;
        }),
      updateProfile: (patch) => write((current) => ({ ...current, profile: { ...current.profile, ...patch } })),
      reset: () => write(() => ledger),
    };
  }, [account, ledger, router, saveNote, write]);

  if (!api) {
    return <p className="px-6 py-16 text-sm text-muted">{saveNote}</p>;
  }
  return <AccountContext.Provider value={api}>{children}</AccountContext.Provider>;
}

function monthName(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
