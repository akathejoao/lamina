import { daysLeftInMonth, monthKey, parseMoney, todayISO } from "./money";
import { categoryBucket } from "./sheets";
import type { Entry, EntryType, Goal, LedgerState, Sheet } from "./types";

const ESSENTIAL = new Set([
  "Moradia",
  "Contas",
  "Mercado",
  "Transporte",
  "Saúde",
]);

export type Bucket = "essenciais" | "estilo" | "futuro";

export type HealthLevel = "Crítico" | "Equilibrado" | "Poupador" | "Investidor";

export type SheetMath = {
  income: number;
  burn: number;
  invested: number;
  free: number;
  essenciais: number;
  estilo: number;
  futuro: number;
  byCategory: { category: string; cents: number }[];
  subscriptions: Entry[];
  dues: { entry: Entry; distance: number }[];
  daily: number;
  daysLeft: number;
  closed: boolean;
};

export function sheetEntries(state: LedgerState, sheetId: string): Entry[] {
  return state.entries
    .filter((entry) => entry.sheetId === sheetId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

export function bucketOf(entry: Entry, sheet?: Sheet): Bucket | null {
  if (entry.type === "receita") return null;
  const chosen = sheet ? categoryBucket(sheet, entry.category) : null;
  if (chosen) return chosen;
  if (entry.type === "investimento") return "futuro";
  if (ESSENTIAL.has(entry.category)) return "essenciais";
  return "estilo";
}

export function mathFor(state: LedgerState, sheet: Sheet, now = todayISO()): SheetMath {
  const entries = sheetEntries(state, sheet.id);
  const sum = (list: Entry[]) => list.reduce((total, entry) => total + entry.cents, 0);
  // Cada saída cai em um só balde. Futuro é o que foi guardado; o resto é gasto.
  const income = sum(entries.filter((entry) => entry.type === "receita"));
  const essenciais = sum(entries.filter((entry) => bucketOf(entry, sheet) === "essenciais"));
  const estilo = sum(entries.filter((entry) => bucketOf(entry, sheet) === "estilo"));
  const futuro = sum(entries.filter((entry) => bucketOf(entry, sheet) === "futuro"));
  const invested = futuro;
  const burn = essenciais + estilo;
  const free = income - burn - invested;
  const categories = new Map<string, number>();
  for (const entry of entries) {
    if (entry.type === "receita") continue;
    categories.set(entry.category, (categories.get(entry.category) ?? 0) + entry.cents);
  }
  const day = Number(now.slice(8, 10));
  const dues = entries
    .filter((entry) => entry.dueDay !== null)
    .map((entry) => ({ entry, distance: (entry.dueDay ?? 0) - day }))
    .filter((item) => item.distance >= 0 && item.distance <= 7)
    .sort((a, b) => a.distance - b.distance);
  const daysLeft = daysLeftInMonth(now);
  const closed = sheet.kind === "mensal" && sheet.month !== null && sheet.month < monthKey(now);
  return {
    income,
    burn,
    invested,
    free,
    essenciais,
    estilo,
    futuro,
    byCategory: [...categories.entries()]
      .map(([category, cents]) => ({ category, cents }))
      .sort((a, b) => b.cents - a.cents),
    subscriptions: entries.filter((entry) => entry.type === "assinatura"),
    dues,
    daily: Math.max(0, Math.floor(free / daysLeft)),
    daysLeft,
    closed,
  };
}

export function currentMonthly(state: LedgerState, now = todayISO()): Sheet | undefined {
  const key = monthKey(now);
  return (
    state.sheets.find((sheet) => sheet.kind === "mensal" && sheet.month === key && !sheet.archived) ??
    state.sheets.find((sheet) => sheet.kind === "mensal" && !sheet.archived)
  );
}

export function streak(state: LedgerState, now = todayISO()): number {
  const months = state.sheets
    .filter((sheet) => sheet.kind === "mensal" && sheet.month && sheet.month <= monthKey(now))
    .sort((a, b) => (b.month ?? "").localeCompare(a.month ?? ""));
  let count = 0;
  for (const sheet of months) {
    const numbers = mathFor(state, sheet, now);
    if (numbers.income - numbers.burn < 0) break;
    count += 1;
  }
  return count;
}

export function health(state: LedgerState, now = todayISO()): {
  level: HealthLevel;
  rate: number;
  emergency: number;
} {
  const sheet = currentMonthly(state, now);
  const goal = state.goals.find((item) => item.id === "goal-reserva");
  const emergency = goal && goal.targetCents > 0 ? goal.savedCents / goal.targetCents : 0;
  if (!sheet) return { level: "Equilibrado", rate: 0, emergency };
  const numbers = mathFor(state, sheet, now);
  const rate = numbers.income === 0 ? 0 : (numbers.income - numbers.burn) / numbers.income;
  const essentialShare = numbers.income === 0 ? 1 : numbers.essenciais / numbers.income;
  let level: HealthLevel = "Equilibrado";
  if (rate < 0 || essentialShare > 0.7) level = "Crítico";
  else if (rate >= 0.25 && emergency >= 0.5) level = "Investidor";
  else if (rate >= 0.1) level = "Poupador";
  return { level, rate, emergency };
}

export function tips(state: LedgerState, sheet: Sheet, now = todayISO()): string[] {
  const numbers = mathFor(state, sheet, now);
  const lines: string[] = [];
  const lazer = numbers.byCategory.find((item) => item.category === "Lazer");
  const cut = lazer ? Math.round(lazer.cents * 0.15) : 0;
  if (cut >= 1_000) {
    lines.push(`Reduzir 15% em Lazer este mês libera ${brl(cut)} para a reserva.`);
  }
  const delivery = numbers.byCategory.find((item) => item.category === "Delivery");
  if (delivery && delivery.cents > 20_000) {
    lines.push(
      `Delivery já soma ${brl(delivery.cents)} no ciclo. Em doze meses iguais, são ${brl(delivery.cents * 12)} saindo sem você perceber.`,
    );
  }
  const forgotten = numbers.subscriptions.filter((item) => item.cents < 2_000);
  if (forgotten.length) {
    const total = forgotten.reduce((sum, item) => sum + item.cents, 0);
    lines.push(
      `${forgotten.map((item) => item.title).join(" e ")} parecem pequenas, mas somam ${brl(total * 12)} por ano. Vale abrir o extrato e decidir se ainda usam.`,
    );
  }
  if (numbers.free < 0) {
    lines.push(
      `O mês está ${brl(Math.abs(numbers.free))} no vermelho depois dos aportes. Segure variável antes de criar um gasto novo.`,
    );
  } else if (numbers.daily > 0) {
    lines.push(
      `Até o fim do mês cabem ${brl(numbers.daily)} por dia sem furar o que já está lançado.`,
    );
  }
  return lines;
}

export function patrimony(state: LedgerState): number {
  return state.goals.reduce((sum, goal) => sum + goal.savedCents, 0);
}

export function goalProgress(goal: Goal): number {
  if (goal.targetCents <= 0) return 0;
  return Math.min(1, goal.savedCents / goal.targetCents);
}

function brl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function tidyTalk(text: string): string {
  return text
    .toLowerCase()
    .replace(/\burbe\b|\buberr?\b|\bubr\b/g, "uber")
    .replace(/\bnetfli\w*\b/g, "netflix")
    .replace(/\bspotfy\b|\bspotifi\w*\b/g, "spotify")
    .replace(/\bifod\b|\bifoo\b/g, "ifood")
    .replace(/\bmercad[oa]?\b/g, "mercado")
    .replace(/\bfarm[aá]cia\b/g, "farmacia");
}

export function guessEntry(text: string): {
  type: EntryType;
  category: string;
  title: string;
} {
  const normalized = tidyTalk(text);
  const rules: { test: RegExp; type: EntryType; category: string; title: string }[] = [
    { test: /sal[aá]rio/, type: "receita", category: "Salário", title: "Salário" },
    { test: /freelance|extra|bico/, type: "receita", category: "Extra", title: "Renda extra" },
    { test: /aluguel|condom[ií]nio/, type: "fixo", category: "Moradia", title: "Moradia" },
    { test: /luz|energia|água|agua|internet|g[aá]s/, type: "fixo", category: "Contas", title: "Conta da casa" },
    { test: /mercado|padaria|feira|horti/, type: "variavel", category: "Mercado", title: "Mercado" },
    { test: /ifood|delivery|rappi|restaurante/, type: "variavel", category: "Delivery", title: "Delivery" },
    { test: /uber|99\b|transporte|metrô|metro|ônibus|onibus|combust[ií]vel/, type: "variavel", category: "Transporte", title: "Transporte" },
    { test: /farm[aá]cia|rem[eé]dio|consulta|m[eé]dic/, type: "variavel", category: "Saúde", title: "Saúde" },
    { test: /lazer|cinema|\bshow\b|\bbar\b|festa|roupa|\bcaf[eé]\b/, type: "variavel", category: "Lazer", title: "Lazer" },
    { test: /netflix|spotify|disney|youtube|streaming|prime\b/, type: "assinatura", category: "Streaming", title: "Streaming" },
    { test: /academia|gym/, type: "assinatura", category: "Academia", title: "Academia" },
    { test: /icloud|software|assinatura/, type: "assinatura", category: "Software", title: "Assinatura" },
    { test: /reserva|aporte|investimento|tesouro|cdb/, type: "investimento", category: "Reserva", title: "Aporte" },
  ];
  const match = rules.find((rule) => rule.test.test(normalized));
  if (match) return { type: match.type, category: match.category, title: match.title };
  return { type: "variavel", category: "Outros", title: "Lançamento" };
}

export type CsvRow = {
  date: string;
  title: string;
  cents: number;
  type: EntryType;
  category: string;
};

export function parseCsv(text: string): CsvRow[] {
  return readCsv(text).rows;
}

const TYPES: EntryType[] = ["receita", "fixo", "variavel", "assinatura", "investimento"];

// Lê o CSV e conta as linhas que ficaram de fora, para avisar em vez de sumir com elas.
// Valor negativo é saída e positivo é entrada quando o arquivo tem sinal (extrato de banco).
export function readCsv(text: string): { rows: CsvRow[]; skipped: number } {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  if (lines.length < 2) return { rows: [], skipped: 0 };
  const delimiter = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
  const header = splitCsvLine(lines[0], delimiter).map((cell) => cell.trim().toLowerCase());
  const index = (names: string[]) => header.findIndex((cell) => names.includes(cell));
  const dateIndex = index(["data", "date", "dia"]);
  const titleIndex = index(["descricao", "descrição", "titulo", "título", "nome", "title", "historico", "histórico"]);
  const valueIndex = index(["valor", "value", "amount", "quantia"]);
  const typeIndex = index(["tipo", "type"]);
  const categoryIndex = index(["categoria", "category", "tag"]);
  if (titleIndex < 0 || valueIndex < 0) return { rows: [], skipped: lines.length - 1 };
  const parsed = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delimiter).map((cell) => cell.trim());
    return { cells, value: signedCents(cells[valueIndex] ?? "") };
  });
  const signed = parsed.some((row) => row.value !== null && row.value < 0);
  const rows: CsvRow[] = [];
  let skipped = 0;
  for (const { cells, value } of parsed) {
    const title = cells[titleIndex] ?? "";
    if (!title || value === null || value === 0) {
      skipped += 1;
      continue;
    }
    const hinted = (cells[typeIndex] ?? "").toLowerCase();
    const category = categoryIndex >= 0 ? cells[categoryIndex] ?? "" : "";
    const guessed = guessEntry(`${hinted} ${title} ${category}`);
    let type: EntryType = TYPES.includes(hinted as EntryType) ? (hinted as EntryType) : guessed.type;
    if (!TYPES.includes(hinted as EntryType) && signed) {
      if (value > 0) type = "receita";
      else if (type === "receita") type = "variavel";
    }
    rows.push({
      date: normalizeDate(cells[dateIndex] ?? "") ?? todayISO(),
      title,
      cents: Math.abs(value),
      type,
      category: category || (type === "receita" && guessed.category === "Outros" ? "Extra" : guessed.category),
    });
  }
  return { rows, skipped };
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function signedCents(raw: string): number | null {
  let value = raw.replace(/\s/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (value.startsWith("-") || value.startsWith("−")) {
    negative = true;
    value = value.slice(1);
  } else if (value.startsWith("+")) {
    value = value.slice(1);
  }
  value = value.replace(/^r\$/i, "");
  if (value.startsWith("-") || value.startsWith("−")) {
    negative = true;
    value = value.slice(1);
  }
  const cents = parseMoney(value);
  if (cents === null) return null;
  return negative ? -cents : cents;
}

function normalizeDate(raw: string): string | null {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
