import { daysLeftInMonth, monthKey, parseMoney, todayISO, uid } from "./money";
import { categoryBucket, SLICE_LABEL, splitOf } from "./sheets";
import type { Entry, EntrySource, EntryType, Goal, LedgerState, Sheet } from "./types";

const ESSENTIAL = new Set([
  "Moradia",
  "Contas",
  "Mercado",
  "Transporte",
  "Saúde",
]);

export type Bucket = "essenciais" | "estilo" | "futuro";

export type HealthLevel = "Sem dados" | "Crítico" | "Equilibrado" | "Poupador" | "Investidor";

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
    // Mês sem renda e sem gasto não prova nada: não soma e também não quebra a sequência.
    if (numbers.income === 0 && numbers.burn === 0 && numbers.invested === 0) continue;
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
  if (!sheet) return { level: "Sem dados", rate: 0, emergency };
  const numbers = mathFor(state, sheet, now);
  if (numbers.income === 0 && sheetEntries(state, sheet.id).length === 0) {
    return { level: "Sem dados", rate: 0, emergency };
  }
  const rate = numbers.income === 0 ? 0 : (numbers.income - numbers.burn) / numbers.income;
  const essentialShare = numbers.income === 0 ? 1 : numbers.essenciais / numbers.income;
  let level: HealthLevel = "Equilibrado";
  if (rate < 0 || essentialShare > 0.7) level = "Crítico";
  else if (rate >= 0.25 && emergency >= 0.5) level = "Investidor";
  else if (rate >= 0.1) level = "Poupador";
  return { level, rate, emergency };
}

// O número que o cartão da planilha mostra na tela inicial, com o rótulo certo para cada tipo.
export function sheetHeadline(state: LedgerState, sheet: Sheet, now = todayISO()): { label: string; cents: number } {
  const numbers = mathFor(state, sheet, now);
  if (sheet.kind === "mensal") return { label: "Livre", cents: numbers.free };
  if (sheet.kind === "meta") {
    const target = sheet.targetCents ?? 0;
    if (target > 0) return { label: `Guardado de ${brl(target)}`, cents: numbers.futuro };
    return { label: "Gasto", cents: numbers.burn };
  }
  return { label: "Patrimônio", cents: numbers.futuro };
}

type Tip = { weight: number; text: string };

function pct(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.round((part / whole) * 100);
}

function namesOf(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function daysInMonthOf(iso: string): number {
  const [year, month] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Dicas que só aparecem quando a condição vale e sempre citam número calculado da planilha.
// Cada regra dá um peso; as mais importantes vêm primeiro e a lista fecha em seis.
export function tips(state: LedgerState, sheet: Sheet, now = todayISO()): string[] {
  const n = mathFor(state, sheet, now);
  const entries = sheetEntries(state, sheet.id);
  const pool: Tip[] = [];
  const add = (weight: number, text: string) => pool.push({ weight, text });
  const mensal = sheet.kind === "mensal";
  const thisMonth = mensal && sheet.month === monthKey(now);
  const day = Number(now.slice(8, 10));
  const plan = splitOf(sheet);

  const spending = entries.filter((entry) => entry.type !== "receita" && bucketOf(entry, sheet) !== "futuro");
  const byCategory = new Map<string, number>();
  for (const entry of spending) byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + entry.cents);
  const categories = [...byCategory.entries()].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents);
  const catCents = (name: string) => categories.find((item) => item.category === name)?.cents ?? 0;

  // 1. Planilha vazia.
  if (entries.length === 0) {
    add(98, "Esta planilha ainda não tem lançamentos. Escreva no chat o seu salário e o primeiro gasto, e as dicas passam a usar os seus números.");
  }

  // 2. Livre negativo.
  if (n.free < 0) {
    add(
      100,
      `O mês está ${brl(Math.abs(n.free))} no vermelho depois dos aportes. Segure variável antes de criar um gasto novo.`,
    );
  }

  // 3. Gasto sem renda lançada.
  if (mensal && entries.length > 0 && n.income === 0 && n.burn + n.invested > 0) {
    add(
      95,
      `Ainda não há receita lançada em ${sheet.name} e já saíram ${brl(n.burn + n.invested)}. Lance o salário para o Livre fazer sentido.`,
    );
  }

  // 4. Contas que vencem nos próximos sete dias.
  if (thisMonth) {
    const due = n.dues.filter((item) => item.entry.type !== "receita");
    if (due.length) {
      const shown = due.slice(0, 3).map((item) => `${item.entry.title} (dia ${item.entry.dueDay}, ${brl(item.entry.cents)})`);
      const more = due.length > 3 ? ` e mais ${due.length - 3}` : "";
      const total = due.reduce((sum, item) => sum + item.entry.cents, 0);
      add(
        90,
        `${plural(due.length, "Vence 1 conta", `Vencem ${due.length} contas`)} nos próximos 7 dias: ${namesOf(shown)}${more}. Soma ${brl(total)}.`,
      );
    }
  }

  // 5. Fatia acima do plano.
  if (n.income > 0 && sheet.kind !== "continuo") {
    let worst: { text: string; over: number } | null = null;
    for (const bucket of ["essenciais", "estilo"] as const) {
      const planned = Math.round((n.income * plan[bucket]) / 100);
      const actual = n[bucket];
      const over = actual - planned;
      if (over > 0 && pct(actual, n.income) > plan[bucket] && (!worst || over > worst.over)) {
        worst = {
          over,
          text: `${SLICE_LABEL[bucket]} já leva ${pct(actual, n.income)}% da renda de ${brl(n.income)}, e o plano da planilha é ${plan[bucket]}%. São ${brl(over)} acima do plano.`,
        };
      }
    }
    if (worst) add(80, worst.text);
  }

  // 6. Futuro abaixo do plano.
  if (mensal && n.income > 0 && plan.futuro > 0) {
    const planned = Math.round((n.income * plan.futuro) / 100);
    if (n.futuro < planned) {
      add(
        75,
        `Futuro está em ${brl(n.futuro)} e o plano é ${plan.futuro}% da renda, ${brl(planned)}. Faltam ${brl(planned - n.futuro)} para fechar o plano.`,
      );
    }
  }

  // 7. Ritmo de gasto contra os dias do mês.
  if (thisMonth && day >= 7 && n.income > 0 && n.free >= 0 && n.burn > 0) {
    const projected = Math.round((n.burn / day) * daysInMonthOf(now));
    const available = n.income - n.futuro;
    if (projected > available) {
      add(
        70,
        `Se o ritmo dos ${day} primeiros dias continuar (${brl(n.burn)} gastos), o mês fecha em ${brl(projected)} de gasto, acima dos ${brl(available)} que sobram da renda depois do que foi guardado.`,
      );
    } else {
      add(
        32,
        `No ritmo dos ${day} primeiros dias, o gasto fecha o mês em ${brl(projected)}, e ficam ${brl(available - projected)} da renda depois do que foi guardado.`,
      );
    }
  }

  // 8. Uma categoria concentra o gasto.
  const top = categories[0];
  if (top && categories.length >= 2 && n.burn > 0 && top.cents / n.burn > 0.4) {
    add(65, `${top.category} concentra ${pct(top.cents, n.burn)}% do gasto: ${brl(top.cents)} de ${brl(n.burn)}.`);
  }

  // 9. Delivery contra mercado.
  const delivery = catCents("Delivery");
  if (delivery > 20_000) {
    const market = catCents("Mercado");
    const versus = market > 0 ? `, ${pct(delivery, market)}% do que foi no Mercado (${brl(market)})` : "";
    add(
      market > 0 && delivery > market / 2 ? 60 : 40,
      `Delivery soma ${brl(delivery)} no ciclo${versus}. Em doze meses iguais, são ${brl(delivery * 12)} saindo sem você perceber.`,
    );
  }

  // 10. Assinaturas somadas e anualizadas.
  const subs = n.subscriptions;
  if (subs.length >= 2) {
    const total = subs.reduce((sum, item) => sum + item.cents, 0);
    add(55, `${subs.length} assinaturas somam ${brl(total)} no ciclo e ${brl(total * 12)} se o ano repetir igual.`);
  }

  // 11. Assinaturas pequenas que passam despercebidas.
  const forgotten = subs.filter((item) => item.cents < 2_000);
  if (forgotten.length) {
    const total = forgotten.reduce((sum, item) => sum + item.cents, 0);
    add(
      50,
      `${namesOf(forgotten.map((item) => item.title))} ${plural(forgotten.length, "parece pequena, mas soma", "parecem pequenas, mas somam")} ${brl(total * 12)} por ano. Vale abrir o extrato e decidir se ainda ${plural(forgotten.length, "usa", "usam")}.`,
    );
  }

  // 12. Cortar 15% de Lazer.
  const cut = Math.round(catCents("Lazer") * 0.15);
  if (cut >= 1_000) {
    add(45, `Reduzir 15% em Lazer este mês libera ${brl(cut)} para a reserva.`);
  }

  // 13. Parcelas que ainda estão rodando.
  const running = entries.filter((entry) => entry.installment && entry.installment.current < entry.installment.total);
  if (running.length) {
    const left = (entry: Entry) => entry.cents * ((entry.installment?.total ?? 0) - (entry.installment?.current ?? 0));
    const remaining = running.reduce((sum, entry) => sum + left(entry), 0);
    const biggest = [...running].sort((a, b) => left(b) - left(a))[0];
    const where = `${biggest.title} (parcela ${biggest.installment?.current}/${biggest.installment?.total})`;
    add(
      58,
      running.length === 1
        ? `${where} segue rodando. Depois desta ainda faltam ${brl(remaining)} em parcelas.`
        : `${running.length} parcelamentos seguem rodando e faltam ${brl(remaining)} depois das parcelas deste ciclo. O maior é ${where}.`,
    );
  }

  // 14. Progresso da reserva de emergência.
  const reserve = state.goals.find((item) => item.id === "goal-reserva");
  if (reserve) {
    if (reserve.targetCents <= 0) {
      add(30, `A meta de ${reserve.name} ainda não está definida. Defina no Perfil para acompanhar o progresso.`);
    } else if (reserve.savedCents >= reserve.targetCents) {
      add(25, `${reserve.name} já bateu a meta de ${brl(reserve.targetCents)}.`);
    } else {
      const missing = reserve.targetCents - reserve.savedCents;
      const base = `${reserve.name} está em ${pct(reserve.savedCents, reserve.targetCents)}% (${brl(reserve.savedCents)} de ${brl(reserve.targetCents)}).`;
      if (mensal && n.futuro > 0) {
        const months = Math.ceil(missing / n.futuro);
        add(52, `${base} No ritmo deste ciclo (${brl(n.futuro)} guardados), faltam ${months} ${plural(months, "mês", "meses")} para fechar.`);
      } else if (mensal) {
        add(52, `${base} Faltam ${brl(missing)} e nada foi guardado neste ciclo ainda.`);
      } else {
        add(35, `${base} Faltam ${brl(missing)}.`);
      }
    }
  }

  // 15. Renda concentrada numa fonte só.
  if (mensal && n.income > 0) {
    const sources = new Map<string, { title: string; cents: number }>();
    for (const entry of entries.filter((item) => item.type === "receita")) {
      const key = fold(entry.title);
      const found = sources.get(key);
      sources.set(key, { title: found?.title ?? entry.title, cents: (found?.cents ?? 0) + entry.cents });
    }
    const main = [...sources.values()].sort((a, b) => b.cents - a.cents)[0];
    if (main && main.cents / n.income >= 0.9) {
      add(
        28,
        `${pct(main.cents, n.income)}% da renda de ${brl(n.income)} vem de uma fonte só, ${main.title}. Se ela atrasar, o mês inteiro trava.`,
      );
    }
  }

  // 16. Um gasto variável pesa muito na renda.
  if (mensal && n.income > 0) {
    const big = spending.filter((entry) => entry.type === "variavel").sort((a, b) => b.cents - a.cents)[0];
    if (big && big.cents / n.income >= 0.2) {
      add(42, `${big.title} foi o maior gasto variável: ${brl(big.cents)}, ${pct(big.cents, n.income)}% da renda. Vale conferir se estava no plano.`);
    }
  }

  // 17. Sobra boa que precisa de destino.
  if (mensal && n.income > 0 && n.free > 0 && n.free / n.income >= 0.2) {
    add(30, `Sobraram ${brl(n.free)}, ${pct(n.free, n.income)}% da renda, depois dos gastos e aportes. Decida agora para onde vão, antes que virem gasto.`);
  }

  // 18. Quanto cabe por dia.
  if (thisMonth && n.free > 0 && n.daily > 0) {
    add(35, `Até o fim do mês cabem ${brl(n.daily)} por dia sem furar o que já está lançado.`);
  }

  return pool
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .slice(0, 6)
    .map((item) => item.text);
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

// Operações puras sobre a planilha. O modo demonstração e o modo conta usam as mesmas,
// então o que entra e o que sai mexem nas metas do mesmo jeito nos dois.

export type DraftEntry = {
  type: EntryType;
  title: string;
  category: string;
  cents: number;
  date: string;
  dueDay?: number | null;
  installment?: { current: number; total: number } | null;
  source?: EntrySource;
};

// Quais metas um lançamento de investimento alimenta.
function goalLinks(entry: Pick<Entry, "type" | "category" | "title">): string[] {
  if (entry.type !== "investimento") return [];
  const ids: string[] = [];
  if (/reserva/i.test(entry.category)) ids.push("goal-reserva");
  if (/viagem|jap[aã]o/i.test(`${entry.category} ${entry.title}`)) ids.push("goal-jp");
  return ids;
}

function shiftGoals(goals: Goal[], entry: Pick<Entry, "type" | "category" | "title" | "cents">, sign: 1 | -1): Goal[] {
  const ids = goalLinks(entry);
  if (!ids.length) return goals;
  return goals.map((goal) =>
    ids.includes(goal.id) ? { ...goal, savedCents: Math.max(0, goal.savedCents + sign * entry.cents) } : goal,
  );
}

export function addEntryTo(current: LedgerState, sheetId: string, draft: DraftEntry): LedgerState {
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
  if (draft.source) item.source = draft.source;
  return { ...current, entries: [...current.entries, item], goals: shiftGoals(current.goals, item, 1) };
}

// Tira os lançamentos e devolve da meta o que eles tinham somado, sem passar de zero.
export function removeEntries(current: LedgerState, shouldRemove: (entry: Entry) => boolean): LedgerState {
  let goals = current.goals;
  let changed = false;
  const kept: Entry[] = [];
  for (const entry of current.entries) {
    if (shouldRemove(entry)) {
      goals = shiftGoals(goals, entry, -1);
      changed = true;
    } else {
      kept.push(entry);
    }
  }
  return changed ? { ...current, entries: kept, goals } : current;
}

export function restoreEntryTo(current: LedgerState, entry: Entry): LedgerState {
  if (current.entries.some((item) => item.id === entry.id)) return current;
  return { ...current, entries: [...current.entries, entry], goals: shiftGoals(current.goals, entry, 1) };
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Copia o mês para o seguinte: fixos, assinaturas e salário. O dia cabe no mês novo (31 vira 28, 29 ou 30),
// a parcela avança (3/12 vira 4/12) e a que já foi a última não volta.
export function duplicateMonthIn(
  current: LedgerState,
  sheetId: string,
  makeId: () => string = uid,
): { state: LedgerState; id: string } | null {
  const source = current.sheets.find((sheet) => sheet.id === sheetId);
  if (!source?.month) return null;
  const [year, month] = source.month.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  const key = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  if (current.sheets.some((sheet) => sheet.month === key)) return null;
  const last = daysInMonthOf(`${key}-01`);
  const newId = makeId();
  const copies: Entry[] = [];
  for (const entry of current.entries) {
    if (entry.sheetId !== sheetId) continue;
    if (!(entry.type === "fixo" || entry.type === "assinatura" || entry.category === "Salário")) continue;
    if (entry.installment && entry.installment.current >= entry.installment.total) continue;
    const day = Math.min(Number(entry.date.slice(8, 10)) || 1, last);
    copies.push({
      ...entry,
      id: makeId(),
      sheetId: newId,
      date: `${key}-${String(day).padStart(2, "0")}`,
      dueDay: entry.dueDay === null ? null : Math.min(entry.dueDay, last),
      installment: entry.installment ? { current: entry.installment.current + 1, total: entry.installment.total } : null,
    });
  }
  return {
    id: newId,
    state: {
      ...current,
      sheets: [
        ...current.sheets,
        { ...source, id: newId, name: monthLabel(key), kind: "mensal", month: key, deadline: null, targetCents: null, archived: false },
      ],
      entries: [...current.entries, ...copies],
    },
  };
}

const CENTS_CAP = 100_000_000_000;

function wholeCents(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.min(CENTS_CAP, Math.max(0, Math.round(value)));
}

export function updateGoalIn(
  current: LedgerState,
  id: string,
  patch: { name?: string; targetCents?: number; savedCents?: number; note?: string },
): LedgerState {
  if (!current.goals.some((goal) => goal.id === id)) return current;
  return {
    ...current,
    goals: current.goals.map((goal) => {
      if (goal.id !== id) return goal;
      const next = { ...goal };
      if (typeof patch.name === "string" && patch.name.trim()) next.name = patch.name.trim().slice(0, 80);
      if (typeof patch.note === "string") next.note = patch.note.trim().slice(0, 280);
      if (typeof patch.targetCents === "number") next.targetCents = wholeCents(patch.targetCents) ?? goal.targetCents;
      if (typeof patch.savedCents === "number") next.savedCents = wholeCents(patch.savedCents) ?? goal.savedCents;
      return next;
    }),
  };
}
