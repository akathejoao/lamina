import { fixTypos, guessEntry, mathFor, readCsv, type CsvRow, type SheetMath } from "./finance";
import { formatBRL, formatMonth, parseMoney, todayISO } from "./money";
import type { EntryType, LedgerState, Sheet } from "./types";

export { AGENT_TERMS } from "./finance";

// Milhar com ponto (5.400, 1.234,56), decimal com vírgula ou ponto (85,50 ou 85.50) e inteiro.
// "mil" e "k" multiplicam por mil: "2 mil", "2k", "2,5 mil".
const AMOUNT = String.raw`(?:\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?(?![\d.])|\d+[.,]\d{1,2}(?!\d)|\d+)`;
const MONEY = String.raw`(?:r\$\s*)?(${AMOUNT}(?:\s*(?:mil|k)(?![a-zà-ú0-9]))?)`;
const UNIT = String.raw`\s*(?:reais|real|conto|contos)?`;
const PREP = String.raw`(?:no|na|nos|nas|em|com|de|do|da|dos|das|pra|para|pro|num|numa)`;
// Descrição que vem antes do valor: precisa de pelo menos duas letras, conferido depois.
const DESC = String.raw`([\p{L}0-9º°ª][\p{L}0-9º°ª\s'/&.-]{0,50}?)`;
const DESC_SEP = String.raw`(?:\s+(?:de|é|eh)\s+|\s*[:=]\s*|\s+)`;

const SPEND_VERB = String.raw`(?:gastei|paguei|comprei|saiu|lan[cç]a|torrei|desembolsei|transferi|fiz\s+um\s+pix(?:\s+(?:de|para|pra))?|pix\s+(?:de|para|pra)|investi|guardei|apliquei|aportei|economizei)`;
const INCOME_VERB = String.raw`(?:recebi|recebo|entrou|ganhei|ganho|caiu(?:\s+na\s+conta)?|me\s+pagaram|pix\s+recebido(?:\s+de)?|depositaram)`;

const DAY_WORDS = /(?<![\p{L}])(?:ante-?ontem|ontem|hoje)(?![\p{L}])/giu;
const ASK = /^\s*(?:quanto|quantos|quantas|qual|quais|como|simule|simular|onde|por\s*que|porque|quando|quem|o\s+que|me\s+(?:diga|fala|mostra|mostre)|posso|devo|cabe|ser[aá])\b/i;
// Número seguido de uma destas palavras é data, hora ou contagem, não valor.
const NOT_A_PRICE = /(?:^|\s)(?:dia|dias|hora|horas|ano|anos|m[eê]s|meses|vez|vezes|at[eé]|[aà]s|x)$/i;

export function amountCents(raw: string): number | null {
  const trimmed = raw.trim();
  const thousand = /\s*(?:mil|k)$/i.test(trimmed);
  const cents = parseMoney(trimmed.replace(/\s*(?:mil|k)$/i, ""));
  if (cents === null) return null;
  return thousand ? cents * 1000 : cents;
}

// Sobrou número colado ao valor ("85.5.0", "12 34"): melhor perguntar do que gravar errado.
function unclear(detail: string): boolean {
  return /^[.,]?\d/.test(detail.trim());
}

const UNCLEAR = "Não tenho certeza do valor. Escreva só o número, como R$ 85,50 ou 2 mil.";

export type AgentOutcome = {
  reply: string;
  entry?: {
    type: EntryType;
    title: string;
    category: string;
    cents: number;
    date: string;
  };
  csv?: CsvRow[];
};

type Kind = "auto" | "spend" | "income" | "saving";

type When = { date: string; word: string };

function daysBefore(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
}

function whenOf(text: string): When {
  const today = todayISO();
  if (/(?<![\p{L}])ante-?ontem(?![\p{L}])/iu.test(text)) return { date: daysBefore(today, 2), word: "anteontem" };
  if (/(?<![\p{L}])ontem(?![\p{L}])/iu.test(text)) return { date: daysBefore(today, 1), word: "ontem" };
  return { date: today, word: "hoje" };
}

function hasLetters(value: string): boolean {
  return (value.match(/\p{L}/gu) ?? []).length >= 2;
}

export function interpret(text: string, state: LedgerState, sheet: Sheet): AgentOutcome {
  const trimmed = text.trim();
  const numbers = mathFor(state, sheet);
  const tone = state.profile.tone;
  if (looksLikeCsv(trimmed)) {
    const { rows, skipped } = readCsv(trimmed);
    if (!rows.length) {
      return { reply: "Não consegui ler esse CSV. Use colunas data, descricao, valor e, se quiser, tipo." };
    }
    const total = rows.reduce((sum, row) => sum + row.cents, 0);
    const left = skipped ? ` ${skipped} linha${skipped > 1 ? "s ficaram" : " ficou"} de fora por falta de descrição ou valor.` : "";
    return {
      reply: `Li ${rows.length} linha${rows.length > 1 ? "s" : ""} (${formatBRL(total)}) e coloquei na planilha ${sheet.name}.${left}`,
      csv: rows,
    };
  }
  const when = whenOf(trimmed);
  const body = trimmed.replace(DAY_WORDS, " ").replace(/\s+/g, " ").trim();
  const asking = ASK.test(body);
  const salary = asking
    ? null
    : body.match(new RegExp(String.raw`sal[aá]rio(?:\s+mensal)?(?:\s+(?:é|eh|e|de|fica))?[\s:=]*${MONEY}`, "i"));
  if (salary && !/gastei|paguei|comprei|13\s*[º°o]|d[eé]cimo/i.test(body)) {
    const cents = amountCents(salary[1]);
    if (!cents) return { reply: "Diz o valor do salário. Por exemplo: meu salário é R$ 5.400." };
    return {
      entry: { type: "receita", title: "Salário", category: "Salário", cents, date: when.date },
      reply: `Anotei o salário: ${formatBRL(cents)}${when.word === "hoje" ? "" : ` ${when.word}`}. Livre agora: ${formatBRL(numbers.free + cents)}.`,
    };
  }
  if (!asking) {
    const spend = body.match(new RegExp(String.raw`\b(${SPEND_VERB})\s+${MONEY}${UNIT}(?:\s+${PREP})?\s*(.*)$`, "i"));
    if (spend) {
      const cents = amountCents(spend[2]);
      if (cents === null || cents === 0) return { reply: "Não entendi o valor. Tenta de novo com R$ 85 ou 85,00." };
      if (unclear(spend[3] ?? "")) return { reply: UNCLEAR };
      return launch(cents, spend[3] ?? "", numbers, tone, when, spendKind(spend[1]), spend[1]);
    }
    const spendLate = body.match(
      new RegExp(String.raw`\b(${SPEND_VERB})\s+${DESC}${DESC_SEP}${MONEY}${UNIT}[.!]?$`, "iu"),
    );
    if (spendLate && hasLetters(spendLate[2]) && !NOT_A_PRICE.test(spendLate[2].trim())) {
      const cents = amountCents(spendLate[3]);
      if (cents) return launch(cents, spendLate[2], numbers, tone, when, spendKind(spendLate[1]), spendLate[1]);
    }
    const income = body.match(
      new RegExp(String.raw`\b(${INCOME_VERB})\s+${MONEY}${UNIT}(?:\s+(?:de|em|do|da|dos|das|por|pelo|pela))?\s*(.*)$`, "i"),
    );
    if (income) {
      const cents = amountCents(income[2]);
      if (cents === null || cents === 0) return { reply: "Não entendi o valor que entrou." };
      if (unclear(income[3] ?? "")) return { reply: UNCLEAR };
      return launch(cents, income[3] ?? "", numbers, tone, when, "income", income[1]);
    }
    const incomeLate = body.match(
      new RegExp(String.raw`\b(${INCOME_VERB})\s+${DESC}${DESC_SEP}${MONEY}${UNIT}[.!]?$`, "iu"),
    );
    if (incomeLate && hasLetters(incomeLate[2]) && !NOT_A_PRICE.test(incomeLate[2].trim())) {
      const cents = amountCents(incomeLate[3]);
      if (cents) return launch(cents, incomeLate[2], numbers, tone, when, "income", incomeLate[1]);
    }
    const loose = body.match(
      new RegExp(String.raw`^${MONEY}${UNIT}(?:\s+(?:de|do|da|no|na|em|com|pra|para|pro|num|numa))?\s+(.+)$`, "i"),
    );
    if (loose) {
      const cents = amountCents(loose[1]);
      const detail = loose[2] ?? "";
      if (unclear(detail)) return { reply: UNCLEAR };
      if (cents && detail.trim()) return launch(cents, detail, numbers, tone, when, "auto", "");
    }
    const named = body.match(
      new RegExp(
        String.raw`^(?:(?:o|a|os|as|meu|minha|meus|minhas)\s+)?([a-zà-ú0-9][\p{L}0-9\s]{0,40}?)\s+(?:é|eh|=|:)\s*${MONEY}(?:\s*reais|real)?$`,
        "iu",
      ),
    );
    if (named) {
      const cents = amountCents(named[2]);
      const detail = (named[1] ?? "").trim();
      if (cents && detail) return launch(cents, detail, numbers, tone, when, "auto", "");
    }
  }
  if (/quanto posso gastar|por dia|at[eé] o fim do m[eê]s/i.test(body)) {
    return { reply: dailyReply(numbers, tone) };
  }
  const sim = body.match(new RegExp(String.raw`(?:simule|simular|guardar)[\s\S]{0,48}?${MONEY}`, "i"));
  if (sim) {
    const cents = amountCents(sim[1]);
    if (!cents) return { reply: "Diz o valor mensal da simulação, por exemplo: simule se eu guardar R$ 400." };
    return { reply: simulate(state, cents, tone) };
  }
  if (!asking) {
    // A descrição vem primeiro e o valor depois: "vale alimentação de 350 reais", "uber 30", "aluguel: 1800".
    const first = body.match(new RegExp(String.raw`^${DESC}${DESC_SEP}${MONEY}${UNIT}[.!]?$`, "iu"));
    if (first && hasLetters(first[1]) && !NOT_A_PRICE.test(first[1].trim())) {
      const cents = amountCents(first[2]);
      if (cents) return launch(cents, first[1], numbers, tone, when, "auto", "");
    }
  }
  if (/assinatur/i.test(trimmed)) return { reply: subscriptionReply(numbers) };
  if (/vazament|onde.*escap|diagn[oó]stico/i.test(trimmed)) return { reply: leakReply(numbers, tone) };
  if (/sa[uú]de|score|term[oô]metro/i.test(trimmed)) return { reply: "O termômetro está no perfil. Ele olha o mês aberto, a fatia essencial e a reserva. Não é uma nota genérica." };
  return {
    reply: joinTone(
      tone,
      "Pode ser “meu salário é R$ 5.400”, “vale alimentação 350”, “uber 30” ou “gastei R$ 85 no mercado ontem”.",
      `Também respondo quanto cabe por dia e simulo um aporte. Livre agora: ${formatBRL(numbers.free)}.`,
    ),
  };
}

function spendKind(verb: string): Kind {
  return /^(?:investi|guardei|apliquei|aportei|economizei)/i.test(verb.trim()) ? "saving" : "spend";
}

function dailyReply(numbers: SheetMath, tone: LedgerState["profile"]["tone"]): string {
  if (numbers.free < 0) {
    return `Não cabe gasto novo por dia. O mês está ${formatBRL(Math.abs(numbers.free))} abaixo de zero depois do que já foi lançado.`;
  }
  const line = `Cabem ${formatBRL(numbers.daily)} por dia nos ${numbers.daysLeft} dias que faltam. Livre no ciclo: ${formatBRL(numbers.free)}.`;
  if (tone === "calmo") return `Sem pressa. ${line} Se um dia passar disso, o seguinte compensa.`;
  return line;
}

function simulate(state: LedgerState, cents: number, tone: LedgerState["profile"]["tone"]): string {
  const goal = state.goals.find((item) => item.id === "goal-reserva") ?? state.goals[0];
  if (!goal) return "Não há meta aberta para simular.";
  const missing = Math.max(0, goal.targetCents - goal.savedCents);
  if (missing === 0) return `${goal.name} já chegou na meta.`;
  const months = Math.ceil(missing / cents);
  const calm = tone === "calmo" ? " É um ritmo que dá para sustentar sem sumir com o lazer inteiro." : "";
  return `Se entrar ${formatBRL(cents)} todo mês em ${goal.name}, a meta fecha em ${months} ${months === 1 ? "mês" : "meses"}. Faltam ${formatBRL(missing)}.${calm}`;
}

function subscriptionReply(numbers: SheetMath): string {
  if (!numbers.subscriptions.length) return "Não há assinatura lançada neste ciclo.";
  const total = numbers.subscriptions.reduce((sum, item) => sum + item.cents, 0);
  const list = numbers.subscriptions.map((item) => `${item.title} ${formatBRL(item.cents)}`).join(", ");
  return `Assinaturas deste ciclo: ${list}. Soma ${formatBRL(total)} agora e ${formatBRL(total * 12)} se o ano repetir igual.`;
}

function leakReply(numbers: SheetMath, tone: LedgerState["profile"]["tone"]): string {
  const top = numbers.byCategory.filter((item) => item.category !== "Moradia" && item.category !== "Reserva")[0];
  if (!top) return "Ainda não há gasto variável suficiente para apontar um vazamento.";
  const year = top.cents * 12;
  const direct = `${top.category} é o maior escape fora da moradia: ${formatBRL(top.cents)} neste ciclo, ${formatBRL(year)} se repetir doze vezes.`;
  if (tone === "calmo") return `${direct} Não precisa zerar. Cortar um pedaço já muda a reserva.`;
  return direct;
}

function looksLikeCsv(text: string): boolean {
  const [first = "", second] = text.split(/\r?\n/);
  return (
    second !== undefined &&
    /[;\t,]/.test(first) &&
    /descri[cç][aã]o|valor|hist[oó]rico|lan[cç]amento|d[eé]bito|cr[eé]dito|quantia|montante/i.test(first)
  );
}

function label(type: EntryType): string {
  if (type === "receita") return "receita";
  if (type === "fixo") return "gasto fixo";
  if (type === "assinatura") return "assinatura";
  if (type === "investimento") return "investimento";
  return "gasto variável";
}

const ACRONYMS = new Set(["iptu", "ipva", "plr", "vr", "cdb", "lci", "lca", "mei", "inss", "irpf", "darf", "iof", "fii", "fiis", "tv"]);

// Título a partir do que o usuário escreveu: sem artigo ou preposição na frente, com a grafia dele.
export function cleanTitle(detail: string): string {
  let value = fixTypos(detail).replace(DAY_WORDS, " ").replace(/\s+/g, " ").trim();
  value = value.replace(/^(?:reais|real|contos?)(?![\p{L}])\s*/iu, "");
  value = value.replace(/(?<![\p{L}])na\s+conta(?![\p{L}])/giu, " ");
  const lead = /^(?:no|na|nos|nas|de|do|da|dos|das|em|com|pra|para|pro|num|numa|o|a|os|as|um|uma|meu|minha|meus|minhas)(?:\s+|$)/i;
  for (let i = 0; i < 4; i += 1) {
    const next = value.replace(lead, "").trim();
    if (next === value) break;
    value = next;
  }
  value = value
    .replace(/\s+(?:de|do|da|no|na|em|com|pra|para|pro)$/i, "")
    .replace(/[.?!,;:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!hasLetters(value)) return "";
  value = value.replace(/[\p{L}]+/gu, (word) => (ACRONYMS.has(word) ? word.toUpperCase() : word));
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function launch(
  cents: number,
  detail: string,
  numbers: SheetMath,
  tone: LedgerState["profile"]["tone"],
  when: When,
  kind: Kind,
  verb: string,
): AgentOutcome {
  const spending = kind === "spend" || kind === "saving";
  const guessed = guessEntry(detail, { spending });
  const pix = /pix/i.test(verb);
  const cleaned = cleanTitle(detail);
  let type: EntryType = guessed.type;
  let category = guessed.category;
  let title = cleaned || guessed.title;
  if (kind === "saving") {
    type = "investimento";
    category = "Reserva";
    title = cleaned || "Aporte";
  } else if (kind === "income") {
    type = "receita";
    if (guessed.type !== "receita") category = "Extra";
    if (!cleaned) title = pix ? "Pix recebido" : guessed.matched ? guessed.title : "Renda extra";
  }
  if (pix) {
    if (kind === "income") title = cleaned ? `Pix recebido de ${cleaned}` : "Pix recebido";
    else title = cleaned ? `Pix para ${cleaned}` : "Pix";
  }
  const after = numbers.free - (type === "receita" ? -cents : cents);
  const entry = { type, title, category, cents, date: when.date };
  if (type === "receita") {
    return {
      entry,
      reply: joinTone(
        tone,
        `Entrou ${formatBRL(cents)} em ${category}${when.word === "hoje" ? "" : `, ${when.word}`}.`,
        `Livre agora: ${formatBRL(after)}.`,
      ),
    };
  }
  return {
    entry,
    reply: joinTone(
      tone,
      `Lancei ${formatBRL(cents)} em ${category}, como ${label(type)}, ${when.word}.`,
      `Livre no mês: ${formatBRL(after)}.`,
    ),
  };
}

function joinTone(tone: LedgerState["profile"]["tone"], lead: string, rest: string): string {
  if (tone === "calmo") return `${lead} ${rest}`;
  return `${lead} ${rest}`;
}

export function cycleCaption(sheet: Sheet): string {
  if (sheet.kind === "mensal" && sheet.month) return formatMonth(sheet.month);
  if (sheet.kind === "meta" && sheet.deadline) return `prazo ${sheet.deadline.split("-").reverse().join("/")}`;
  return "patrimônio contínuo";
}
