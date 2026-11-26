import { bucketOf, fixTypos, fold, guessEntry, mathFor, readCsv, sheetEntries, type CsvRow, type SheetMath } from "./finance";
import { formatBRL, formatDay, formatMonth, parseMoney, todayISO } from "./money";
import { categoriesOf } from "./sheets";
import type { Entry, EntryType, LedgerState, Sheet } from "./types";

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
  // Id do lançamento do chat que o usuário pediu para desfazer. Quem aplica a resposta remove esse lançamento.
  undoEntryId?: string;
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

export function interpret(text: string, state: LedgerState, sheet: Sheet, now = todayISO()): AgentOutcome {
  const trimmed = text.trim();
  const numbers = mathFor(state, sheet, now);
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
  const asked = answerQuestion(trimmed, state, sheet, numbers, now);
  if (asked) return asked;
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
    // Descrição, valor e um destino curto depois: "aporte de 400 na reserva", "pix de 50 pro João".
    const tail = body.match(
      new RegExp(String.raw`^${DESC}${DESC_SEP}${MONEY}${UNIT}\s+(?:n[ao]s?|em|pr[ao]s?|para|no\s+|na\s+)\s*([a-zà-ú][a-zà-ú ]{1,40})[.!]?$`, "iu"),
    );
    if (tail && hasLetters(tail[1]) && !NOT_A_PRICE.test(tail[1].trim())) {
      const cents = amountCents(tail[2]);
      if (cents) return launch(cents, `${tail[1]} ${tail[tail.length - 1]}`, numbers, tone, when, "auto", "");
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

// ---- Perguntas e comandos curtos. Respondem com os números da planilha e nunca criam lançamento. ----

// Só para comparar: sem acento, sem pontuação, com as gírias mais comuns trocadas.
function norm(text: string): string {
  return fold(text)
    .replace(/[?!.,;:()"“”¿]+/g, " ")
    .replace(/(\p{L})\1{2,}/gu, "$1")
    .replace(/\b(?:vc|vce|voces)\b/g, "voce")
    .replace(/\b(?:qto|qnto|qt|quant)\b/g, "quanto")
    .replace(/\bq\b/g, "que")
    .replace(/\bgast(?:ie|ey)\b/g, "gastei")
    .replace(/\s+/g, " ")
    .trim();
}

const ITEM = String.raw`(?:lancamento|gasto|entrada|registro|item)`;
const UNDO_A = new RegExp(String.raw`^desfa(?:z|zer|ca|za)(?:\s+(?:o\s+)?(?:ultim[oa](?:\s+${ITEM})?|isso|esse|este))?$`);
const UNDO_B = new RegExp(
  String.raw`^(?:apag(?:a|ar|ue)|cancel(?:a|ar|e)|remov(?:e|er)|exclu(?:i|ir)|delet(?:a|ar|e)|tira|tirar)\s+(?:o\s+|a\s+)?ultim[oa](?:\s+${ITEM})?$`,
);
const SPENT = /\bquanto(?:s)?\s+(?:que\s+)?(?:eu\s+|voce\s+|a\s+gente\s+)?(?:ja\s+)?(?:gastei|gastamos|gastou|paguei|torrei|gasto)\b(.*)$/;
const SPENT_BARE = /^(?:meus\s+|o\s+total\s+de\s+|total\s+de\s+)?gastos?\b(.*)$/;
const BALANCE =
  /\b(?:qual\s+(?:e\s+)?(?:o\s+)?(?:meu\s+)?saldo|meu\s+saldo|saldo(?:\s+(?:do|desse|deste|esse|este)\s+(?:mes|ciclo))?|quanto\s+(?:que\s+)?(?:me\s+)?(?:sobrou|sobra|sobrando|resta|restou)|quanto\s+(?:que\s+)?(?:eu\s+)?(?:ainda\s+)?(?:tenho|to\s+com|estou\s+com)\s+(?:livre|sobrando|disponivel|de\s+sobra|no\s+bolso)|como\s+(?:eu\s+)?(?:estou|to|tou|ando)(?:\s+(?:indo|esse\s+mes|este\s+mes|no\s+mes|de\s+grana|de\s+dinheiro|financeiramente))?|como\s+(?:esta|ta|vai|anda)\s+(?:meu|o|a)\s+(?:mes|saldo|grana|situacao|financas))\b/;
const BIGGEST =
  /\b(?:maior(?:es)?\s+(?:gasto|despesa|compra|lancamento|saida)s?|(?:onde|em\s+que|no\s+que|com\s+o\s+que)\s+(?:que\s+)?(?:eu\s+)?(?:mais\s+)?gastei(?:\s+mais)?|o\s+que\s+(?:eu\s+)?mais\s+(?:gastei|pesou)|onde\s+mais\s+(?:gasto|gastei|foi\s+o\s+dinheiro))\b/;
const GOAL_LEFT =
  /\b(?:quanto\s+(?:que\s+)?(?:ainda\s+)?(?:me\s+)?falta(?:m)?|falta\s+quanto|quanto\s+(?:que\s+)?(?:eu\s+)?(?:ainda\s+)?(?:preciso|devo)\s+(?:guardar|juntar))\b.*\b(?:meta|reserva|emergencia|objetivo|viagem|japao|cofre)\b|\bcomo\s+(?:esta|ta|anda|vai)\s+(?:a\s+|minha\s+)?(?:meta|reserva)\b/;
const SUMMARY =
  /^(?:(?:me\s+)?(?:da|de|faz|faca|fala|mostra|mostre|manda)\s+(?:um\s+|o\s+)?)?(?:resumo|resumao|balanco|panorama)(?:\s+(?:do|desse|deste|de|da)\s+(?:mes|ciclo|planilha|tudo))?$/;
const STOP = new Set(
  "esse este neste nesse nesta nessa essa desta dessa no na nos nas do da de dos das em com o a os as mes ciclo planilha hoje ontem semana ate agora ja eu voce total tudo mais so la pra para por aqui um uma mensal que ao aos".split(" "),
);

function spendOnly(sheet: Sheet, entry: Entry): boolean {
  return entry.type !== "receita" && bucketOf(entry, sheet) !== "futuro";
}

function share(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.round((part / whole) * 100);
}

function count(total: number): string {
  return `${total} ${total === 1 ? "lançamento" : "lançamentos"}`;
}

function inCurrentMonth(sheet: Sheet, numbers: SheetMath, now: string): boolean {
  return sheet.kind === "mensal" && !numbers.closed && sheet.month === now.slice(0, 7);
}

function answerQuestion(text: string, state: LedgerState, sheet: Sheet, numbers: SheetMath, now: string): AgentOutcome | null {
  const n = norm(text);
  if (!n) return null;
  if (UNDO_A.test(n) || UNDO_B.test(n)) return undoReply(state, sheet, numbers);
  if (SUMMARY.test(n)) return summaryReply(state, sheet, numbers, now);
  const short = n.split(" ").length <= 10 && !/\d/.test(n);
  if (short && BIGGEST.test(n)) return biggestReply(state, sheet, numbers);
  if (short && GOAL_LEFT.test(n)) return goalLeftReply(state, sheet, numbers, n);
  if (short && BALANCE.test(n) && !/por dia|ate o fim/.test(n)) return balanceReply(state, sheet, numbers, now);
  const spent = n.match(SPENT);
  if (spent) return spentReply(spent[1] ?? "", state, sheet, numbers, now);
  const bare = n.match(SPENT_BARE);
  if (bare && !/\d/.test(bare[1] ?? "")) return spentReply(bare[1] ?? "", state, sheet, numbers, now);
  return null;
}

function undoReply(state: LedgerState, sheet: Sheet, numbers: SheetMath): AgentOutcome {
  const last = [...state.entries].reverse().find((entry) => entry.sheetId === sheet.id && entry.source === "agente");
  if (!last) {
    return { reply: "Não há nada para desfazer. Só desfaço o que eu mesmo lancei pelo chat nesta planilha." };
  }
  const after = last.type === "receita" ? numbers.free - last.cents : numbers.free + last.cents;
  return {
    undoEntryId: last.id,
    reply: `Apaguei o último lançamento do chat: ${last.title}, ${formatBRL(last.cents)} (${label(last.type)}, ${last.category}). Livre agora: ${formatBRL(after)}.`,
  };
}

function balanceReply(state: LedgerState, sheet: Sheet, numbers: SheetMath, now: string): AgentOutcome {
  if (!sheetEntries(state, sheet.id).length) {
    return { reply: `Ainda não há lançamento em ${sheet.name}. Diga seu salário e o primeiro gasto para eu calcular o livre.` };
  }
  const free = numbers.free < 0 ? `${formatBRL(numbers.free)}, no vermelho` : formatBRL(numbers.free);
  const daily =
    inCurrentMonth(sheet, numbers, now) && numbers.daily > 0
      ? ` Cabem ${formatBRL(numbers.daily)} por dia nos ${numbers.daysLeft} dias que faltam.`
      : "";
  return {
    reply: `Em ${sheet.name} entrou ${formatBRL(numbers.income)}, você gastou ${formatBRL(numbers.burn)} e guardou ${formatBRL(numbers.futuro)}. Livre: ${free}.${daily}`,
  };
}

function biggestReply(state: LedgerState, sheet: Sheet, numbers: SheetMath): AgentOutcome {
  const spending = sheetEntries(state, sheet.id).filter((entry) => spendOnly(sheet, entry));
  if (!spending.length) return { reply: `Ainda não há gasto lançado em ${sheet.name}.` };
  const byCategory = new Map<string, number>();
  for (const entry of spending) byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + entry.cents);
  const [category, cents] = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  const single = [...spending].sort((a, b) => b.cents - a.cents)[0];
  return {
    reply: `Maior categoria: ${category}, ${formatBRL(cents)}, ${share(cents, numbers.burn)}% do gasto. Maior lançamento: ${single.title}, ${formatBRL(single.cents)}, em ${formatDay(single.date).replace(/.$/, "")}.`,
  };
}

function goalLeftReply(state: LedgerState, sheet: Sheet, numbers: SheetMath, n: string): AgentOutcome {
  const wantsTrip = /\b(?:viagem|japao|cofre)\b/.test(n);
  const goal =
    (wantsTrip ? state.goals.find((item) => item.id === "goal-jp") : undefined) ??
    state.goals.find((item) => item.id === "goal-reserva") ??
    state.goals[0];
  if (!goal) return { reply: "Não há meta cadastrada ainda." };
  if (goal.targetCents <= 0) {
    return {
      reply: `A meta de ${goal.name} ainda não está definida. Defina a meta no Perfil e eu calculo quanto falta. Hoje há ${formatBRL(goal.savedCents)} guardados.`,
    };
  }
  const missing = goal.targetCents - goal.savedCents;
  if (missing <= 0) return { reply: `${goal.name} já chegou na meta de ${formatBRL(goal.targetCents)}.` };
  const base = `Faltam ${formatBRL(missing)} para a meta de ${goal.name}: ${formatBRL(goal.savedCents)} guardados de ${formatBRL(goal.targetCents)}, ${share(goal.savedCents, goal.targetCents)}%.`;
  if (sheet.kind === "mensal" && numbers.futuro > 0) {
    const months = Math.ceil(missing / numbers.futuro);
    return { reply: `${base} No ritmo deste ciclo (${formatBRL(numbers.futuro)} guardados), fecha em ${months} ${months === 1 ? "mês" : "meses"}.` };
  }
  return { reply: base };
}

function summaryReply(state: LedgerState, sheet: Sheet, numbers: SheetMath, now: string): AgentOutcome {
  const entries = sheetEntries(state, sheet.id);
  if (!entries.length) {
    return { reply: `Ainda não há lançamentos em ${sheet.name}. Diga o salário e o primeiro gasto para eu montar o resumo.` };
  }
  const free = numbers.free < 0 ? `${formatBRL(numbers.free)}, no vermelho` : formatBRL(numbers.free);
  const first = `${sheet.name}: entrou ${formatBRL(numbers.income)}, gastou ${formatBRL(numbers.burn)} e guardou ${formatBRL(numbers.futuro)}. Livre: ${free}.`;
  const spending = entries.filter((entry) => spendOnly(sheet, entry));
  const byCategory = new Map<string, number>();
  for (const entry of spending) byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + entry.cents);
  const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  const second = top
    ? `Maior categoria: ${top[0]}, ${formatBRL(top[1])}, ${share(top[1], numbers.burn)}% do gasto.`
    : "Ainda não há gasto lançado.";
  const live = inCurrentMonth(sheet, numbers, now);
  const due = live ? numbers.dues.find((item) => item.entry.type !== "receita") : undefined;
  let third = `${count(entries.length)} nesta planilha.`;
  if (due) {
    third = `Próxima conta: ${due.entry.title}, dia ${due.entry.dueDay}, ${formatBRL(due.entry.cents)}.`;
  } else if (live && numbers.daily > 0) {
    third = `Cabem ${formatBRL(numbers.daily)} por dia nos ${numbers.daysLeft} dias que faltam.`;
  }
  return { reply: [first, second, third].join("\n") };
}

function spentReply(rest: string, state: LedgerState, sheet: Sheet, numbers: SheetMath, now: string): AgentOutcome {
  let from: string | null = null;
  let lead = `Em ${sheet.name}`;
  let none = `em ${sheet.name}`;
  if (/\bhoje\b/.test(rest)) {
    from = now;
    lead = "Hoje";
    none = "hoje";
  } else if (/\bontem\b/.test(rest)) {
    from = daysBefore(now, 1);
    lead = "Ontem";
    none = "ontem";
  } else if (/\bsemana\b/.test(rest)) {
    from = daysBefore(now, 6);
    lead = "Nos últimos 7 dias";
    none = "nos últimos 7 dias";
  }
  const until = from !== null && /\bontem\b/.test(rest) ? from : now;
  const pool = sheetEntries(state, sheet.id).filter(
    (entry) => entry.type !== "receita" && (from === null || (entry.date >= from && entry.date <= until)),
  );
  const periodSpend = pool.filter((entry) => spendOnly(sheet, entry));
  const periodTotal = periodSpend.reduce((sum, entry) => sum + entry.cents, 0);
  const tokens = rest.split(" ").filter((word) => word && !STOP.has(word) && !/^\d+$/.test(word));

  if (!tokens.length) {
    if (!periodSpend.length) return { reply: from === null ? `Ainda não há gasto lançado em ${sheet.name}.` : `Não há gasto lançado ${none}.` };
    const saved = pool.filter((entry) => !spendOnly(sheet, entry)).reduce((sum, entry) => sum + entry.cents, 0);
    const kept = saved > 0 ? ` Fora isso, guardou ${formatBRL(saved)}.` : "";
    const free = from === null ? ` Livre: ${formatBRL(numbers.free)}.` : "";
    return { reply: `${lead} você gastou ${formatBRL(periodTotal)} em ${count(periodSpend.length)}.${kept}${free}` };
  }

  const phrase = tokens.join(" ");
  const known = new Set<string>([...categoriesOf(sheet).map((item) => item.name), ...pool.map((entry) => entry.category)]);
  let category = [...known].find((name) => {
    const key = fold(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![a-z0-9])${key}(?![a-z0-9])`).test(phrase);
  });
  if (!category) {
    const guessed = guessEntry(phrase, { spending: true });
    if (guessed.matched) category = guessed.category;
  }
  const wanted = category ? fold(category) : null;
  const subset = pool.filter((entry) =>
    wanted !== null ? fold(entry.category) === wanted : tokens.some((word) => word.length >= 3 && fold(entry.title).includes(word)),
  );
  const name = category ?? `“${phrase}”`;
  const spentSet = subset.filter((entry) => spendOnly(sheet, entry));
  const spentTotal = spentSet.reduce((sum, entry) => sum + entry.cents, 0);
  if (spentSet.length) {
    const part = periodTotal > 0 ? `, ${share(spentTotal, periodTotal)}% do gasto` : "";
    return { reply: `${lead} você gastou ${formatBRL(spentTotal)} com ${name} (${count(spentSet.length)})${part}.` };
  }
  const savedTotal = subset.reduce((sum, entry) => sum + entry.cents, 0);
  if (subset.length) return { reply: `${lead} você guardou ${formatBRL(savedTotal)} em ${name} (${count(subset.length)}).` };
  return { reply: `Não achei gasto com ${name} ${none}.` };
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
  if (goal.targetCents <= 0) {
    return `A meta de ${goal.name} ainda não está definida. Defina a meta no Perfil e eu simulo em quantos meses fecha.`;
  }
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
