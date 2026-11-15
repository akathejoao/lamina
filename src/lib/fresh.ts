import { monthKey, todayISO } from "./money";
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
  if (!value || typeof value !== "object") return false;
  const record = value as LedgerState;
  return Array.isArray(record.sheets) && Array.isArray(record.entries) && Array.isArray(record.goals) && !!record.profile;
}
