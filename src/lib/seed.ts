import { monthKey, todayISO } from "./money";
import type { LedgerState } from "./types";

// Id da planilha aberta da demonstração. O nome mostrado é o do mês atual.
export const NOVEMBER = "sheet-nov";

function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthName(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// O exemplo anda com o calendário: o mês aberto é o atual e os dois fechados são os anteriores.
// Valores e categorias ficam iguais; só o mês muda, e o dia nunca passa do fim do mês.
export function buildSeed(now = todayISO()): LedgerState {
  const cur = monthKey(now);
  const prev = shiftMonth(cur, -1);
  const prev2 = shiftMonth(cur, -2);
  const at = (key: string, day: number) => {
    const [year, month] = key.split("-").map(Number);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${key}-${String(Math.min(day, last)).padStart(2, "0")}`;
  };
  return {
    profile: {
      name: "Marina Alves",
      handle: "marina",
      banner: "violeta",
      photoDataUrl: null,
      tone: "direto",
      showPatrimony: true,
    },
    sheets: [
      {
        id: "sheet-set",
        name: monthName(prev2),
        kind: "mensal",
        month: prev2,
        deadline: null,
        targetCents: null,
        archived: true,
      },
      {
        id: "sheet-out",
        name: monthName(prev),
        kind: "mensal",
        month: prev,
        deadline: null,
        targetCents: null,
        archived: true,
      },
      {
        id: NOVEMBER,
        name: monthName(cur),
        kind: "mensal",
        month: cur,
        deadline: null,
        targetCents: null,
        archived: false,
      },
      {
        id: "sheet-jp",
        name: "Japão, 2027",
        kind: "meta",
        month: null,
        deadline: "2027-07-01",
        targetCents: 1_200_000,
        archived: false,
      },
      {
        id: "sheet-reserva",
        name: "Reserva de emergência",
        kind: "continuo",
        month: null,
        deadline: null,
        targetCents: 1_800_000,
        archived: false,
      },
    ],
    entries: [
      entry("e1", "sheet-set", "receita", "Salário", "Salário", 820_000, at(prev2, 5), 5, null),
      entry("e2", "sheet-set", "fixo", "Aluguel", "Moradia", 210_000, at(prev2, 5), 5, null),
      entry("e3", "sheet-set", "variavel", "Mercado", "Mercado", 52_000, at(prev2, 12), null, null),
      entry("e4", "sheet-set", "investimento", "Aporte na reserva", "Reserva", 600_000, at(prev2, 28), null, null),
      entry("e5", "sheet-out", "receita", "Salário", "Salário", 820_000, at(prev, 5), 5, null),
      entry("e6", "sheet-out", "receita", "Freelance de identidade", "Extra", 90_000, at(prev, 18), null, null),
      entry("e7", "sheet-out", "fixo", "Aluguel", "Moradia", 210_000, at(prev, 5), 5, null),
      entry("e8", "sheet-out", "variavel", "Mercado", "Mercado", 61_000, at(prev, 11), null, null),
      entry("e9", "sheet-out", "investimento", "Aporte na reserva", "Reserva", 700_000, at(prev, 30), null, null),
      entry("n1", NOVEMBER, "receita", "Salário", "Salário", 820_000, at(cur, 5), 5, null),
      entry("n2", NOVEMBER, "receita", "Freelance de motion", "Extra", 140_000, at(cur, 9), null, null),
      entry("n3", NOVEMBER, "fixo", "Aluguel", "Moradia", 210_000, at(cur, 5), 5, null),
      entry("n4", NOVEMBER, "fixo", "Luz", "Contas", 18_000, at(cur, 18), 18, null),
      entry("n5", NOVEMBER, "fixo", "Internet", "Contas", 12_000, at(cur, 22), 22, null),
      entry("n6", NOVEMBER, "fixo", "Parcela do notebook", "Contas", 31_000, at(cur, 12), 12, {
        current: 3,
        total: 12,
      }),
      entry("n7", NOVEMBER, "assinatura", "Netflix", "Streaming", 5_590, at(cur, 8), 8, null),
      entry("n8", NOVEMBER, "assinatura", "Spotify", "Streaming", 2_190, at(cur, 8), 8, null),
      entry("n9", NOVEMBER, "assinatura", "Academia", "Academia", 12_900, at(cur, 20), 20, null),
      entry("n10", NOVEMBER, "assinatura", "iCloud", "Software", 1_490, at(cur, 3), 3, null),
      entry("n11", NOVEMBER, "variavel", "Mercado da semana", "Mercado", 64_000, at(cur, 4), null, null),
      entry("n12", NOVEMBER, "variavel", "iFood", "Delivery", 38_000, at(cur, 10), null, null),
      entry("n13", NOVEMBER, "variavel", "Saídas e lazer", "Lazer", 214_000, at(cur, 11), null, null),
      entry("n14", NOVEMBER, "variavel", "Uber", "Transporte", 21_000, at(cur, 13), null, null),
      entry("n15", NOVEMBER, "investimento", "Aporte na reserva", "Reserva", 80_000, at(cur, 14), null, null),
      entry("j1", "sheet-jp", "investimento", "Cofre da viagem", "Viagem", 280_000, at(cur, 1), null, null),
      entry("r1", "sheet-reserva", "investimento", "Saldo acumulado", "Reserva", 640_000, at(cur, 1), null, null),
    ],
    goals: [
      {
        id: "goal-reserva",
        name: "Reserva de emergência",
        targetCents: 1_800_000,
        savedCents: 720_000,
        note: "Seis meses de custo essencial. Hoje cobre pouco mais de dois.",
      },
      {
        id: "goal-jp",
        name: "Japão, julho de 2027",
        targetCents: 1_200_000,
        savedCents: 280_000,
        note: "Passagem, hospedagem curta e um colchão para o imprevisto.",
      },
    ],
    messages: [],
  };
}

export const seedState: LedgerState = buildSeed();

function entry(
  id: string,
  sheetId: string,
  type: LedgerState["entries"][number]["type"],
  title: string,
  category: string,
  cents: number,
  date: string,
  dueDay: number | null,
  installment: { current: number; total: number } | null,
): LedgerState["entries"][number] {
  return { id, sheetId, type, title, category, cents, date, dueDay, installment };
}
