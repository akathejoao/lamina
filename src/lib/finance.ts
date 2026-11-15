import { daysLeftInMonth, monthKey, todayISO } from "./money";
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
  const income = sum(entries.filter((entry) => entry.type === "receita"));
  const invested = sum(entries.filter((entry) => entry.type === "investimento"));
  const essenciais = sum(entries.filter((entry) => bucketOf(entry, sheet) === "essenciais"));
  const estilo = sum(entries.filter((entry) => bucketOf(entry, sheet) === "estilo"));
  const futuro = invested;
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
  if (lazer) {
    const cut = Math.round(lazer.cents * 0.15);
    lines.push(
      `Reduzir 15% em Lazer este mês libera ${brl(cut)} para a reserva. No ritmo atual, isso adianta a meta cerca de duas semanas.`,
    );
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

export function guessEntry(text: string): {
  type: EntryType;
  category: string;
  title: string;
} {
  const normalized = text.toLowerCase();
  const rules: { test: RegExp; type: EntryType; category: string; title: string }[] = [
    { test: /sal[aá]rio/, type: "receita", category: "Salário", title: "Salário" },
    { test: /freelance|extra|bico/, type: "receita", category: "Extra", title: "Renda extra" },
    { test: /aluguel|condom[ií]nio/, type: "fixo", category: "Moradia", title: "Moradia" },
    { test: /luz|energia|água|agua|internet|g[aá]s/, type: "fixo", category: "Contas", title: "Conta da casa" },
    { test: /mercado|padaria|feira|horti/, type: "variavel", category: "Mercado", title: "Mercado" },
    { test: /ifood|delivery|rappi|restaurante/, type: "variavel", category: "Delivery", title: "Delivery" },
    { test: /uber|99\b|transporte|metrô|metro|ônibus|onibus/, type: "variavel", category: "Transporte", title: "Transporte" },
    { test: /lazer|cinema|show|bar|festa|roupa/, type: "variavel", category: "Lazer", title: "Lazer" },
    { test: /netflix|spotify|disney|youtube|streaming/, type: "assinatura", category: "Streaming", title: "Streaming" },
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
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(delimiter).map((cell) => cell.trim().toLowerCase());
  const index = (names: string[]) => header.findIndex((cell) => names.includes(cell));
  const dateIndex = index(["data", "date", "dia"]);
  const titleIndex = index(["descricao", "descrição", "titulo", "título", "nome", "title"]);
  const valueIndex = index(["valor", "value", "amount", "quantia"]);
  const typeIndex = index(["tipo", "type"]);
  const categoryIndex = index(["categoria", "category", "tag"]);
  if (titleIndex < 0 || valueIndex < 0) return [];
  const rows: CsvRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
    const rawValue = cells[valueIndex] ?? "";
    const cents = parseLoose(rawValue);
    const title = cells[titleIndex] ?? "";
    if (!title || cents === null) continue;
    const hinted = (cells[typeIndex] ?? "").toLowerCase();
    const guessed = guessEntry(`${hinted} ${title} ${cells[categoryIndex] ?? ""}`);
    const type = (["receita", "fixo", "variavel", "assinatura", "investimento"] as EntryType[]).includes(
      hinted as EntryType,
    )
      ? (hinted as EntryType)
      : guessed.type;
    rows.push({
      date: normalizeDate(cells[dateIndex] ?? "") ?? todayISO(),
      title,
      cents,
      type,
      category: cells[categoryIndex] || guessed.category,
    });
  }
  return rows;
}

function parseLoose(raw: string): number | null {
  const cleaned = raw.replace(/r\$/gi, "").trim();
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(",")) normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(Math.abs(value) * 100);
}

function normalizeDate(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}
