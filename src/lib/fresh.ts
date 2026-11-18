import { monthKey, todayISO } from "./money";
import { safePhoto } from "./photo";
import type { LedgerState } from "./types";

export function freshLedger(name: string): LedgerState {
  const month = monthKey(todayISO());
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)),
  );
  const handle = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
  return {
    profile: {
      name,
      handle: handle || "voce",
      banner: "violeta",
      photoDataUrl: null,
      tone: "direto",
      showPatrimony: true,
    },
    sheets: [
      {
        id: "ciclo-atual",
        name: label.charAt(0).toUpperCase() + label.slice(1),
        kind: "mensal",
        month,
        deadline: null,
        targetCents: null,
        archived: false,
      },
    ],
    entries: [],
    goals: [
      {
        id: "goal-reserva",
        name: "Reserva de emergência",
        targetCents: 0,
        savedCents: 0,
        note: "Defina o valor quando souber quantos meses de essencial quer cobrir.",
      },
    ],
    messages: [],
  };
}

export function isLedger(value: unknown): value is LedgerState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as LedgerState;
  if (!record.profile || typeof record.profile !== "object" || Array.isArray(record.profile)) return false;
  if (!Array.isArray(record.sheets) || record.sheets.length > 400) return false;
  if (!Array.isArray(record.entries) || record.entries.length > 20_000) return false;
  if (!Array.isArray(record.goals) || record.goals.length > 200) return false;
  if (!Array.isArray(record.messages) || record.messages.length > 5_000) return false;
  return true;
}

export function scrubLedger(ledger: LedgerState): LedgerState {
  return {
    ...ledger,
    profile: {
      ...ledger.profile,
      photoDataUrl: safePhoto(ledger.profile.photoDataUrl),
    },
  };
}

export function applyProfilePatch(current: LedgerState, patch: Partial<LedgerState["profile"]>): LedgerState {
  const profile = { ...current.profile, ...patch };
  if ("photoDataUrl" in patch) profile.photoDataUrl = safePhoto(patch.photoDataUrl);
  return scrubLedger({ ...current, profile });
}
