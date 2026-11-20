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

// Sem acento, minúsculo e com hífen virando espaço: é a forma usada só para comparar texto.
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/-/g, " ");
}

// Usado só para casar palavras: minúsculo e sem acento em "farmácia". O título que o usuário vê não passa por aqui.
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

// Corrige só o erro de digitação e mantém caixa e acento do que o usuário escreveu (para o título).
export function fixTypos(text: string): string {
  const swap = (to: string) => (found: string) => (found.toLowerCase() === to ? found : to);
  return text
    .replace(/\burbe\b|\buberr?\b|\bubr\b/gi, swap("uber"))
    .replace(/\bnetfli\w*\b/gi, swap("netflix"))
    .replace(/\bspotfy\b|\bspotifi\w*\b/gi, swap("spotify"))
    .replace(/\bifod\b|\bifoo\b/gi, swap("ifood"))
    .replace(/\bmercada\b/gi, swap("mercado"));
}

type Vocab = { type: EntryType; category: string; title: string; words: string[] };

// Cada palavra aponta para tipo, categoria e um título de reserva. Vale a mais longa que casar:
// "plano de saúde" ganha de "plano", "aluguel recebido" ganha de "aluguel".
const VOCAB: Vocab[] = [
  { type: "receita", category: "Salário", title: "Salário", words: ["salário", "adiantamento", "13º salário", "13 salário", "13º", "13o", "décimo terceiro", "férias", "PLR", "bônus", "comissão", "holerite", "contracheque"] },
  { type: "receita", category: "Extra", title: "Renda extra", words: ["extra", "hora extra", "freelance", "freela", "bico", "reembolso", "cashback", "venda", "vendi", "mesada"] },
  { type: "receita", category: "Extra", title: "Pix recebido", words: ["pix recebido"] },
  { type: "receita", category: "Rendimentos", title: "Rendimentos", words: ["rendimento", "dividendos", "juros recebidos", "aluguel recebido", "proventos"] },
  { type: "receita", category: "Benefícios", title: "Benefício", words: ["vale alimentação", "vale refeição", "VA", "VR", "vale transporte", "benefício", "auxílio", "bolsa família", "pensão recebida", "aposentadoria", "ticket", "sodexo"] },
  { type: "fixo", category: "Moradia", title: "Moradia", words: ["aluguel", "condomínio", "IPTU", "financiamento", "prestação da casa"] },
  { type: "variavel", category: "Moradia", title: "Casa", words: ["reforma", "diarista", "faxina", "pedreiro", "encanador", "eletricista"] },
  { type: "fixo", category: "Contas", title: "Conta da casa", words: ["luz", "energia", "água", "gás", "internet", "wifi", "telefone", "celular", "plano", "tv a cabo", "esgoto"] },
  { type: "variavel", category: "Mercado", title: "Mercado", words: ["mercado", "supermercado", "mercadinho", "padaria", "feira", "hortifruti", "açougue", "atacadão", "atacarejo", "sacolão"] },
  { type: "variavel", category: "Delivery", title: "Delivery", words: ["ifood", "delivery", "rappi", "uber eats", "restaurante", "lanche", "lanchonete", "almoço", "jantar", "café", "cafeteria", "pizza", "hamburguer", "burger", "marmita", "açaí", "sorvete", "churrasco", "sushi", "pastel"] },
  { type: "variavel", category: "Transporte", title: "Transporte", words: ["uber", "99", "ônibus", "passagem de ônibus", "metrô", "trem", "táxi", "bilhete único", "gasolina", "combustível", "etanol", "diesel", "posto", "estacionamento", "pedágio", "oficina", "mecânico", "pneu", "multa", "transporte"] },
  { type: "fixo", category: "Transporte", title: "Carro", words: ["IPVA", "licenciamento", "seguro do carro", "financiamento do carro"] },
  { type: "variavel", category: "Saúde", title: "Saúde", words: ["farmácia", "remédio", "medicamento", "consulta", "médico", "dentista", "exame", "psicólogo", "psiquiatra", "terapia", "fisioterapia", "óculos", "vacina", "hospital"] },
  { type: "fixo", category: "Saúde", title: "Plano de saúde", words: ["plano de saúde"] },
  { type: "assinatura", category: "Academia", title: "Academia", words: ["academia", "gym", "pilates", "crossfit", "smart fit"] },
  { type: "fixo", category: "Educação", title: "Educação", words: ["escola", "faculdade", "mensalidade", "matrícula"] },
  { type: "variavel", category: "Educação", title: "Educação", words: ["curso", "livro", "material escolar", "apostila"] },
  { type: "assinatura", category: "Streaming", title: "Streaming", words: ["netflix", "spotify", "disney", "prime", "prime video", "youtube", "youtube premium", "hbo", "hbo max", "globoplay", "streaming", "deezer", "apple tv", "apple music", "crunchyroll"] },
  { type: "assinatura", category: "Software", title: "Assinatura", words: ["icloud", "google one", "chatgpt", "software", "assinatura", "dropbox", "adobe", "microsoft 365"] },
  { type: "variavel", category: "Lazer", title: "Lazer", words: ["lazer", "cinema", "show", "bar", "barzinho", "balada", "festa", "viagem", "hotel", "reserva de hotel", "pousada", "airbnb", "passagem", "passagem aérea", "presente", "teatro", "ingresso", "parque"] },
  { type: "variavel", category: "Compras", title: "Compras", words: ["roupa", "camisa", "calça", "vestido", "sapato", "tênis", "shopping", "eletrônico", "celular novo", "notebook", "móveis", "mochila", "brinquedo", "amazon", "shopee", "mercado livre"] },
  { type: "variavel", category: "Cuidados", title: "Cuidados pessoais", words: ["cabeleireiro", "barbearia", "barbeiro", "manicure", "salão", "estética", "depilação", "maquiagem", "perfume", "corte de cabelo"] },
  { type: "variavel", category: "Pets", title: "Pet", words: ["pet shop", "petshop", "pet", "ração", "veterinário", "banho e tosa", "tosa"] },
  { type: "fixo", category: "Dívidas", title: "Dívida", words: ["cartão de crédito", "fatura", "fatura do cartão", "cartão", "empréstimo", "parcela", "prestação", "dívida", "consórcio"] },
  { type: "variavel", category: "Dívidas", title: "Juros", words: ["juros", "cheque especial"] },
  { type: "fixo", category: "Impostos", title: "Imposto", words: ["imposto", "imposto de renda", "irpf", "darf", "inss", "das mei", "guia das", "mei", "anuidade", "tarifa bancária"] },
  { type: "variavel", category: "Impostos", title: "Taxa", words: ["taxa", "tarifa", "iof", "cartório"] },
  { type: "fixo", category: "Doações", title: "Dízimo", words: ["dízimo"] },
  { type: "variavel", category: "Doações", title: "Doação", words: ["doação", "caridade", "vaquinha", "igreja"] },
  { type: "investimento", category: "Reserva", title: "Aporte", words: ["reserva", "reserva de emergência", "aporte", "investimento", "tesouro", "tesouro direto", "CDB", "LCI", "LCA", "poupança", "ações", "fii", "fiis", "cripto", "bitcoin", "previdência", "cofrinho", "renda fixa"] },
];

function wordRule(word: string): RegExp {
  const body = fold(word)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const plural = /[a-z]$/.test(fold(word)) ? "s?" : "";
  return new RegExp(`(?<![a-z0-9])${body}${plural}(?![a-z0-9])`);
}

const COMPILED = VOCAB.flatMap((group) =>
  group.words.map((word) => ({ key: fold(word), rule: wordRule(word), type: group.type, category: group.category, title: group.title })),
);

// As palavras que o chat e a importação reconhecem. A interface pode mostrar como exemplos.
export const AGENT_TERMS: string[] = VOCAB.flatMap((group) => group.words);

export function guessEntry(
  text: string,
  options: { spending?: boolean } = {},
): {
  type: EntryType;
  category: string;
  title: string;
  matched: boolean;
} {
  const normalized = fold(tidyTalk(text));
  let best: (typeof COMPILED)[number] | null = null;
  for (const term of COMPILED) {
    if (options.spending && term.type === "receita") continue;
    if (!term.rule.test(normalized)) continue;
    if (!best || term.key.length > best.key.length) best = term;
  }
  if (best) return { type: best.type, category: best.category, title: best.title, matched: true };
  return { type: "variavel", category: "Outros", title: "Lançamento", matched: false };
}

export type CsvRow = {
  date: string;
  title: string;
  cents: number;
  type: EntryType;
  category: string;
  dueDay?: number;
  installment?: { current: number; total: number };
};

export function parseCsv(text: string): CsvRow[] {
  return readCsv(text).rows;
}

const TYPE_BY_NAME: Record<string, EntryType> = {
  receita: "receita",
  entrada: "receita",
  fixo: "fixo",
  "gasto fixo": "fixo",
  variavel: "variavel",
  "gasto variavel": "variavel",
  assinatura: "assinatura",
  investimento: "investimento",
};

function typeFromCell(raw: string): EntryType | null {
  return TYPE_BY_NAME[fold(raw).replace(/\s+/g, " ").trim()] ?? null;
}

type Columns = {
  date: number;
  title: number;
  value: number;
  debit: number;
  credit: number;
  type: number;
  category: number;
  due: number;
  installment: number;
};

function headerKey(cell: string): string {
  return fold(cell.replace(/^﻿/, ""))
    .replace(/["']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function columnsOf(header: string[]): Columns | null {
  const keys = header.map(headerKey);
  const find = (names: string[]) => keys.findIndex((key) => names.includes(key));
  let date = find(["data", "date"]);
  if (date < 0) date = keys.findIndex((key) => /^data\b/.test(key));
  if (date < 0) date = find(["dia"]);
  const columns: Columns = {
    date,
    title: find(["descricao", "titulo", "nome", "title", "historico", "lancamento", "descricao do lancamento", "descricao lancamento", "memo", "detalhe", "detalhes", "estabelecimento", "favorecido"]),
    value: find(["valor", "value", "amount", "quantia", "montante", "valor r", "valor rs", "valor brl"]),
    debit: find(["debito", "debitos", "saida", "saidas", "valor debito", "valor saida"]),
    credit: find(["credito", "creditos", "entrada", "entradas", "valor credito", "valor entrada"]),
    type: find(["tipo", "type"]),
    category: find(["categoria", "category", "tag"]),
    due: find(["vence dia", "vencimento", "vence", "dia vencimento", "dia de vencimento"]),
    installment: find(["parcela", "parcelas"]),
  };
  if (columns.title < 0) return null;
  if (columns.value < 0 && columns.debit < 0 && columns.credit < 0) return null;
  return columns;
}

function pickDelimiters(sample: string): string[] {
  const options = [";", "\t", ","].map((char) => ({ char, count: sample.split(char).length - 1 }));
  const found = options.filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
  return found.length ? found.map((item) => item.char) : [","];
}

function parseRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  const endRecord = () => {
    cells.push(cell);
    if (cells.some((item) => item.trim() !== "")) records.push(cells);
    cells = [];
    cell = "";
  };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (char === delimiter) {
      cells.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      endRecord();
    } else {
      cell += char;
    }
  }
  endRecord();
  return records.filter((record) => !(record.length === 1 && /^sep=.$/i.test(record[0].trim())));
}

function rowValue(cells: string[], columns: Columns): number | null {
  if (columns.value >= 0) {
    const direct = signedCents(cells[columns.value] ?? "");
    if (direct !== null || (columns.debit < 0 && columns.credit < 0)) return direct;
  }
  const credit = columns.credit >= 0 ? signedCents(cells[columns.credit] ?? "") : null;
  const debit = columns.debit >= 0 ? signedCents(cells[columns.debit] ?? "") : null;
  if (credit) return Math.abs(credit);
  if (debit) return -Math.abs(debit);
  return null;
}

function dueDayOf(raw: string): number | null {
  const value = raw.trim();
  if (/^\d{1,2}$/.test(value)) {
    const day = Number(value);
    return day >= 1 && day <= 31 ? day : null;
  }
  const date = normalizeDate(value);
  return date ? Number(date.slice(8, 10)) : null;
}

function installmentOf(raw: string): { current: number; total: number } | null {
  const match = raw.trim().match(/^(\d{1,3})\s*(?:\/|de)\s*(\d{1,3})$/i);
  if (!match) return null;
  const current = Number(match[1]);
  const total = Number(match[2]);
  return current >= 1 && total >= current ? { current, total } : null;
}

// Lê o CSV e conta as linhas que ficaram de fora, para avisar em vez de sumir com elas.
// Aceita arquivo do Excel brasileiro (; e vírgula decimal), extrato de banco com Débito/Crédito
// e o arquivo que a própria planilha exporta. Com coluna Tipo ela manda; sem ela vale o sinal do valor.
export function readCsv(text: string): { rows: CsvRow[]; skipped: number } {
  const clean = text.replace(/^﻿/, "");
  if (clean.trim() === "") return { rows: [], skipped: 0 };
  const sample = clean.slice(0, 4000);
  let records: string[][] = [];
  let columns: Columns | null = null;
  let headerAt = -1;
  for (const delimiter of pickDelimiters(sample)) {
    records = parseRecords(clean, delimiter);
    const limit = Math.min(records.length, 20);
    for (let i = 0; i < limit; i += 1) {
      columns = columnsOf(records[i]);
      if (columns) {
        headerAt = i;
        break;
      }
    }
    if (columns) break;
  }
  if (!columns) return { rows: [], skipped: Math.max(0, records.length - 1) };
  const cols: Columns = columns;
  const parsed = records.slice(headerAt + 1).map((record) => {
    const cells = record.map((cell) => cell.trim());
    return { cells, value: rowValue(cells, cols) };
  });
  const split = cols.debit >= 0 || cols.credit >= 0;
  const signed = split || parsed.some((row) => row.value !== null && row.value < 0);
  const rows: CsvRow[] = [];
  let skipped = 0;
  for (const { cells, value } of parsed) {
    const title = (cells[cols.title] ?? "").replace(/^'(?=[=+\-@])/, "");
    if (!title || value === null || value === 0) {
      skipped += 1;
      continue;
    }
    const typed = cols.type >= 0 ? typeFromCell(cells[cols.type] ?? "") : null;
    const given = cols.category >= 0 ? (cells[cols.category] ?? "").replace(/^'(?=[=+\-@])/, "") : "";
    const guessed = guessEntry(`${title} ${given}`);
    let type: EntryType = typed ?? guessed.type;
    if (!typed && signed) {
      if (value > 0) type = "receita";
      else if (type === "receita") type = "variavel";
    }
    let category = given;
    if (!category) {
      if (type === "receita") category = guessed.type === "receita" ? guessed.category : "Extra";
      else category = guessed.type === "receita" ? "Outros" : guessed.category;
    }
    const row: CsvRow = {
      date: normalizeDate(cells[cols.date] ?? "") ?? todayISO(),
      title,
      cents: Math.abs(value),
      type,
      category,
    };
    const due = cols.due >= 0 ? dueDayOf(cells[cols.due] ?? "") : null;
    if (due !== null) row.dueDay = due;
    const installment = cols.installment >= 0 ? installmentOf(cells[cols.installment] ?? "") : null;
    if (installment) row.installment = installment;
    rows.push(row);
  }
  return { rows, skipped };
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
  // Extratos antigos marcam o sentido no fim: "85,50-", "85,50D" ou "85,50C".
  const tail = value.match(/^(.*\d)([-−+]|[dc])$/i);
  if (tail) {
    const mark = tail[2].toLowerCase();
    if (mark === "-" || mark === "−" || mark === "d") negative = true;
    value = tail[1];
  }
  const cents = parseMoney(value);
  if (cents === null) return null;
  return negative ? -cents : cents;
}

function normalizeDate(raw: string): string | null {
  const value = raw.trim().split(/[ T]/)[0] ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
