import { guessEntry, mathFor, parseCsv, type SheetMath } from "./finance";
import { formatBRL, formatMonth, parseMoney, todayISO } from "./money";
import type { EntryType, LedgerState, Sheet } from "./types";

export type AgentOutcome = {
  reply: string;
  entry?: {
    type: EntryType;
    title: string;
    category: string;
    cents: number;
    date: string;
  };
  csv?: ReturnType<typeof parseCsv>;
};

export function interpret(text: string, state: LedgerState, sheet: Sheet): AgentOutcome {
  const trimmed = text.trim();
  const numbers = mathFor(state, sheet);
  const tone = state.profile.tone;
  if (looksLikeCsv(trimmed)) {
    const rows = parseCsv(trimmed);
    if (!rows.length) {
      return { reply: "Não consegui ler esse CSV. Use colunas data, descricao, valor e, se quiser, tipo." };
    }
    const total = rows.reduce((sum, row) => sum + row.cents, 0);
    return {
      reply: `Li ${rows.length} linha${rows.length > 1 ? "s" : ""} (${formatBRL(total)}) e coloquei na planilha ${sheet.name}.`,
      csv: rows,
    };
  }
  const spend = trimmed.match(
    /(?:gastei|paguei|comprei|saiu|lan[cç]a)\s+(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)\s*(?:reais)?(?:\s+(?:no|na|em|com|de|pra|para))?\s*(.*)$/i,
  );
  if (spend) {
    const cents = parseMoney(spend[1]);
    if (cents === null) return { reply: "Não entendi o valor. Tenta de novo com R$ 85 ou 85,00." };
    const detail = (spend[2] ?? "").replace(/\bhoje\b/i, "").trim();
    const guessed = guessEntry(detail || trimmed);
    const title = detail ? capitalize(detail) : guessed.title;
    const after = numbers.free - (guessed.type === "receita" ? -cents : cents);
    return {
      entry: {
        type: guessed.type,
        title,
        category: guessed.category,
        cents,
        date: todayISO(),
      },
      reply: joinTone(
        tone,
        `Lancei ${formatBRL(cents)} em ${guessed.category}, como ${label(guessed.type)}, hoje.`,
        `Livre no mês: ${formatBRL(after)}.`,
      ),
    };
  }
  const income = trimmed.match(
    /(?:recebi|entrou|ganhei|caiu)\s+(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)\s*(?:reais)?(?:\s+(?:de|em|do|da))?\s*(.*)$/i,
  );
  if (income) {
    const cents = parseMoney(income[1]);
    if (cents === null) return { reply: "Não entendi o valor que entrou." };
    const detail = (income[2] ?? "").trim();
    const guessed = guessEntry(detail || "extra");
    return {
      entry: {
        type: "receita",
        title: detail ? capitalize(detail) : guessed.title,
        category: guessed.category === "Outros" ? "Extra" : guessed.category,
        cents,
        date: todayISO(),
      },
      reply: `Entrou ${formatBRL(cents)}. Livre agora: ${formatBRL(numbers.free + cents)}.`,
    };
  }
  if (/quanto posso gastar|por dia|at[eé] o fim do m[eê]s/i.test(trimmed)) {
    return { reply: dailyReply(numbers, tone) };
  }
  const sim = trimmed.match(
    /(?:simule|simular|guardar)[\s\S]{0,48}?(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/i,
  );
  if (sim) {
    const cents = parseMoney(sim[1]);
    if (!cents) return { reply: "Diz o valor mensal da simulação, por exemplo: simule se eu guardar R$ 400." };
    return { reply: simulate(state, cents, tone) };
  }
  if (/assinatur/i.test(trimmed)) return { reply: subscriptionReply(numbers) };
  if (/vazament|onde.*escap|diagn[oó]stico/i.test(trimmed)) return { reply: leakReply(numbers, tone) };
  if (/sa[uú]de|score|term[oô]metro/i.test(trimmed)) return { reply: "O termômetro está no perfil. Ele olha o mês aberto, a fatia essencial e a reserva — não uma nota genérica." };
  return {
    reply: joinTone(
      tone,
      "Posso lançar um gasto, responder quanto cabe por dia, listar assinaturas ou simular um aporte.",
      `Exemplo: “Gastei R$ 85 no mercado hoje”. Livre agora: ${formatBRL(numbers.free)}.`,
    ),
  };
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
  return /descricao|descrição|valor/i.test(text) && /[,;\n]/.test(text);
}

function label(type: EntryType): string {
  if (type === "receita") return "receita";
  if (type === "fixo") return "gasto fixo";
  if (type === "assinatura") return "assinatura";
  if (type === "investimento") return "investimento";
  return "gasto variável";
}

function capitalize(value: string): string {
  const clean = value.replace(/[.?]$/, "").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
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
