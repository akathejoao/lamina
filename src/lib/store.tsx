"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const api = useMemo<Store>(
    () => ({
      state,
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
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore precisa do StoreProvider");
  return store;
}

export { NOVEMBER };

function monthName(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
