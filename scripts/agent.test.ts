import assert from "node:assert/strict";
import { test } from "node:test";
import { AGENT_TERMS, cleanTitle, interpret } from "../src/lib/agent";
import { fold, guessEntry } from "../src/lib/finance";
import { todayISO } from "../src/lib/money";
import { freshLedger } from "../src/lib/fresh";

const state = freshLedger("Ana");
const sheet = state.sheets[0];

test("100 reais de alguma coisa entra sem o verbo gastei", () => {
  const mercado = interpret("100 reais no mercado", state, sheet);
  assert.equal(mercado.entry?.category, "Mercado");
  assert.equal(mercado.entry?.cents, 10000);

  const uber = interpret("100 real de urbe", state, sheet);
  assert.equal(uber.entry?.category, "Transporte");
  assert.equal(uber.entry?.title, "Uber");
  assert.equal(uber.entry?.cents, 10000);

  const unknown = interpret("100 reais de bugiganga", state, sheet);
  assert.equal(unknown.entry?.category, "Outros");
  assert.equal(unknown.entry?.title, "Bugiganga");

  const pizza = interpret("100 reais de pizza", state, sheet);
  assert.equal(pizza.entry?.category, "Delivery");
  assert.equal(pizza.entry?.title, "Pizza");
});

test("meu salário é um valor vira receita", () => {
  const salary = interpret("meu salário é 5.400", state, sheet);
  assert.equal(salary.entry?.type, "receita");
  assert.equal(salary.entry?.category, "Salário");
  assert.equal(salary.entry?.cents, 540000);

  assert.equal(interpret("meu salario é 2000", state, sheet).entry?.cents, 200000);
  assert.equal(interpret("meu salario é 20000", state, sheet).entry?.cents, 2000000);
  assert.equal(interpret("gastei 2500 no mercado", state, sheet).entry?.cents, 250000);

  const named = interpret("aluguel é 1800", state, sheet);
  assert.equal(named.entry?.type, "fixo");
  assert.equal(named.entry?.category, "Moradia");
  assert.equal(named.entry?.cents, 180000);
});

test("a frase com verbo continua lançando", () => {
  const spent = interpret("gastei 100 reais de uber", state, sheet);
  assert.equal(spent.entry?.category, "Transporte");
  assert.equal(spent.entry?.cents, 10000);
});

function ask(text: string) {
  return interpret(text, state, sheet);
}

function daysAgo(days: number): string {
  const [year, month, day] = todayISO().split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
}

test("a descrição vem primeiro e o valor depois, com ou sem de, dois pontos ou é", () => {
  const cases: [string, string, number, string, string][] = [
    ["vale alimentação de 350 reais", "receita", 35000, "Benefícios", "Vale alimentação"],
    ["vale refeição 600", "receita", 60000, "Benefícios", "Vale refeição"],
    ["uber 30", "variavel", 3000, "Transporte", "Uber"],
    ["mercado 85", "variavel", 8500, "Mercado", "Mercado"],
    ["netflix 55,90", "assinatura", 5590, "Streaming", "Netflix"],
    ["aluguel: 1800", "fixo", 180000, "Moradia", "Aluguel"],
    ["conta de luz 180", "fixo", 18000, "Contas", "Conta de luz"],
    ["farmácia de 42,90", "variavel", 4290, "Saúde", "Farmácia"],
    ["13º salário de 2.700", "receita", 270000, "Salário", "13º salário"],
    ["aluguel 2 mil", "fixo", 200000, "Moradia", "Aluguel"],
    ["R$ 85,50 de padaria", "variavel", 8550, "Mercado", "Padaria"],
  ];
  for (const [phrase, type, cents, category, title] of cases) {
    const entry = ask(phrase).entry;
    assert.ok(entry, phrase);
    assert.equal(entry.type, type, phrase);
    assert.equal(entry.cents, cents, phrase);
    assert.equal(entry.category, category, phrase);
    assert.equal(entry.title, title, phrase);
  }
});

test("pergunta nunca vira lançamento", () => {
  for (const phrase of [
    "quanto posso gastar por dia",
    "quanto gastei no mercado 85",
    "qual o valor de 30",
    "como faço para guardar 400",
    "simule se eu guardar 400",
    "oi",
    "vence dia 15",
    "bom dia 5",
  ]) {
    assert.equal(ask(phrase).entry, undefined, phrase);
  }
});

test("mais verbos de entrada", () => {
  for (const [phrase, cents] of [
    ["recebo 3000 de salário", 300000],
    ["ganho 500 de bico", 50000],
    ["caiu na conta 800", 80000],
    ["caiu 500 na conta", 50000],
    ["me pagaram 300 de freela", 30000],
    ["pix recebido 200", 20000],
    ["depositaram 1000", 100000],
  ] as const) {
    const entry = ask(phrase).entry;
    assert.equal(entry?.type, "receita", phrase);
    assert.equal(entry?.cents, cents, phrase);
  }
  assert.equal(ask("pix recebido de 200 do João").entry?.title, "Pix recebido de João");
  assert.equal(ask("recebi freela 300").entry?.cents, 30000);
});

test("mais verbos de saída", () => {
  for (const [phrase, cents] of [
    ["torrei 200 no bar", 20000],
    ["desembolsei 900 de reforma", 90000],
    ["transferi 500 pra Maria", 50000],
    ["pix de 50 para o João", 5000],
    ["fiz um pix de 200", 20000],
    ["pix para Maria 80", 8000],
  ] as const) {
    const entry = ask(phrase).entry;
    assert.ok(entry, phrase);
    assert.notEqual(entry.type, "receita", phrase);
    assert.equal(entry.cents, cents, phrase);
  }
  assert.equal(ask("pix de 50 para o João").entry?.title, "Pix para João");
  assert.equal(ask("fiz um pix de 200").entry?.title, "Pix");
});

test("investi, guardei, apliquei, aportei e economizei viram reserva", () => {
  for (const phrase of ["investi 500", "guardei 200", "apliquei 1000", "aportei 300", "economizei 150", "guardei 200 pra viagem"]) {
    const entry = ask(phrase).entry;
    assert.equal(entry?.type, "investimento", phrase);
    assert.equal(entry?.category, "Reserva", phrase);
  }
  assert.equal(ask("investi 500 em tesouro").entry?.title, "Tesouro");
  assert.equal(ask("guardei 200").entry?.title, "Aporte");
});

test("o verbo aceita a descrição antes do valor", () => {
  const luz = ask("paguei a luz 180").entry;
  assert.equal(luz?.cents, 18000);
  assert.equal(luz?.category, "Contas");
  assert.equal(luz?.title, "Luz");
  const mercado = ask("gastei no mercado 85").entry;
  assert.equal(mercado?.cents, 8500);
  assert.equal(mercado?.category, "Mercado");
  assert.equal(mercado?.title, "Mercado");
  const aluguel = ask("paguei o aluguel de 1800").entry;
  assert.equal(aluguel?.cents, 180000);
  assert.equal(aluguel?.type, "fixo");
  assert.equal(aluguel?.title, "Aluguel");
});

test("ontem e anteontem mudam a data e saem do título", () => {
  assert.equal(ask("gastei 85,50 no mercado").entry?.date, todayISO());
  const ontem = ask("gastei 85,50 no mercado ontem").entry;
  assert.equal(ontem?.date, daysAgo(1));
  assert.equal(ontem?.title, "Mercado");
  const antes = ask("anteontem paguei 180 de luz").entry;
  assert.equal(antes?.date, daysAgo(2));
  assert.equal(antes?.title, "Luz");
  assert.equal(ask("uber 30 ontem").entry?.date, daysAgo(1));
  assert.equal(ask("recebi 500 de freela ontem").entry?.date, daysAgo(1));
  assert.match(ask("gastei 50 no bar ontem").reply, /ontem/);
});

test("título sem preposição na frente e com a grafia do usuário", () => {
  assert.equal(cleanTitle("no mercado"), "Mercado");
  assert.equal(cleanTitle("de luz"), "Luz");
  assert.equal(cleanTitle("para o João"), "João");
  assert.equal(cleanTitle("farmácia"), "Farmácia");
  assert.equal(cleanTitle("ipva"), "IPVA");
  assert.equal(cleanTitle("em"), "");
  assert.equal(ask("gastei 85,50 no mercado").entry?.title, "Mercado");
  assert.equal(ask("paguei 180 de luz").entry?.title, "Luz");
  assert.equal(ask("gastei 42,90 na farmácia").entry?.title, "Farmácia");
  assert.equal(ask("gastei 300 no açougue").entry?.title, "Açougue");
});

test("vocabulário reconhece palavras do dia a dia", () => {
  const samples: [string, string, string][] = [
    ["vale alimentação", "receita", "Benefícios"],
    ["VR", "receita", "Benefícios"],
    ["VA", "receita", "Benefícios"],
    ["vale transporte", "receita", "Benefícios"],
    ["13º", "receita", "Salário"],
    ["décimo terceiro", "receita", "Salário"],
    ["PLR", "receita", "Salário"],
    ["bônus", "receita", "Salário"],
    ["freela", "receita", "Extra"],
    ["dividendos", "receita", "Rendimentos"],
    ["bolsa família", "receita", "Benefícios"],
    ["IPVA", "fixo", "Transporte"],
    ["seguro do carro", "fixo", "Transporte"],
    ["gasolina", "variavel", "Transporte"],
    ["pedágio", "variavel", "Transporte"],
    ["dentista", "variavel", "Saúde"],
    ["plano de saúde", "fixo", "Saúde"],
    ["psicólogo", "variavel", "Saúde"],
    ["pet shop", "variavel", "Pets"],
    ["veterinário", "variavel", "Pets"],
    ["fatura do cartão", "fixo", "Dívidas"],
    ["empréstimo", "fixo", "Dívidas"],
    ["dízimo", "fixo", "Doações"],
    ["doação", "variavel", "Doações"],
    ["poupança", "investimento", "Reserva"],
    ["tesouro direto", "investimento", "Reserva"],
    ["CDB", "investimento", "Reserva"],
    ["condomínio", "fixo", "Moradia"],
    ["IPTU", "fixo", "Moradia"],
    ["diarista", "variavel", "Moradia"],
    ["internet", "fixo", "Contas"],
    ["açougue", "variavel", "Mercado"],
    ["marmita", "variavel", "Delivery"],
    ["ifood", "variavel", "Delivery"],
    ["faculdade", "fixo", "Educação"],
    ["livro", "variavel", "Educação"],
    ["disney", "assinatura", "Streaming"],
    ["chatgpt", "assinatura", "Software"],
    ["academia", "assinatura", "Academia"],
    ["cinema", "variavel", "Lazer"],
    ["hotel", "variavel", "Lazer"],
    ["tênis", "variavel", "Compras"],
    ["barbearia", "variavel", "Cuidados"],
    ["anuidade", "fixo", "Impostos"],
    ["DAS MEI", "fixo", "Impostos"],
  ];
  for (const [word, type, category] of samples) {
    const guessed = guessEntry(word);
    assert.equal(guessed.type, type, word);
    assert.equal(guessed.category, category, word);
    assert.equal(guessed.matched, true, word);
  }
});

test("a palavra precisa estar inteira e sem acento não atrapalha", () => {
  assert.equal(guessEntry("barato").matched, false);
  assert.equal(guessEntry("gasolina").category, "Transporte");
  assert.equal(guessEntry("agua").category, "Contas");
  assert.equal(guessEntry("cafe da manha").category, "Delivery");
  assert.equal(guessEntry("farmacia").category, "Saúde");
  assert.equal(guessEntry("aluguel recebido").type, "receita");
  assert.equal(guessEntry("aluguel").type, "fixo");
  assert.equal(guessEntry("a casa das tias").matched, false);
  assert.equal(guessEntry("gastei no mercado livre").category, "Compras");
});

test("a lista de palavras do chat tem pelo menos cem termos distintos", () => {
  assert.ok(AGENT_TERMS.length >= 100, String(AGENT_TERMS.length));
  assert.equal(new Set(AGENT_TERMS.map(fold)).size, AGENT_TERMS.length);
});

test("gasto com verbo não vira receita por causa da palavra", () => {
  const entry = ask("gastei 500 em hotel nas férias").entry;
  assert.notEqual(entry?.type, "receita");
  assert.equal(entry?.category, "Lazer");
});

// ---- Perguntas e comandos ----

import { addEntryTo, removeEntries } from "../src/lib/finance";
import type { LedgerState } from "../src/lib/types";

function seeded(): { ledger: LedgerState; sheet: LedgerState["sheets"][number] } {
  const base = freshLedger("Ana");
  const today = todayISO();
  const month = today.slice(0, 7);
  const draft = (type: "receita" | "fixo" | "variavel" | "investimento", title: string, category: string, cents: number, date = `${month}-02`, source?: "agente" | "manual") => ({
    type,
    title,
    category,
    cents,
    date,
    ...(source ? { source } : {}),
  });
  let ledger = base;
  const id = base.sheets[0].id;
  ledger = addEntryTo(ledger, id, draft("receita", "Salário", "Salário", 500_000, `${month}-01`, "manual"));
  ledger = addEntryTo(ledger, id, draft("fixo", "Aluguel", "Moradia", 180_000, `${month}-02`, "manual"));
  ledger = addEntryTo(ledger, id, draft("variavel", "Mercado", "Mercado", 40_000, `${month}-03`, "manual"));
  ledger = addEntryTo(ledger, id, draft("variavel", "Uber", "Transporte", 3_000, today, "agente"));
  ledger = addEntryTo(ledger, id, draft("investimento", "Aporte", "Reserva", 20_000, `${month}-04`, "manual"));
  return { ledger, sheet: ledger.sheets[0] };
}

function say(text: string) {
  const { ledger, sheet } = seeded();
  return interpret(text, ledger, sheet);
}

test("quanto gastei responde com o total do ciclo, do dia e da categoria", () => {
  assert.match(say("quanto gastei esse mês?").reply, /^Em \S+ você gastou R\$\s?2\.230,00/);
  assert.match(say("quanto gastei no mês").reply, /R\$\s?2\.230,00 em 3 lançamentos/);
  assert.match(say("Quanto q gastei?").reply, /R\$\s?2\.230,00/);
  assert.match(say("qto vc gastou").reply, /R\$\s?2\.230,00/);
  assert.match(say("quanto gastei hoje").reply, /^Hoje você gastou R\$\s?30,00 em 1 lançamento\./);
  assert.match(say("quanto gastei com mercado").reply, /R\$\s?400,00 com Mercado \(1 lançamento\), 18% do gasto/);
  assert.match(say("quanto gastei com transporte?").reply, /R\$\s?30,00 com Transporte/);
  assert.match(say("quanto gastei com uber").reply, /R\$\s?30,00 com Transporte/);
  assert.match(say("quanto gastei com reserva").reply, /guardou R\$\s?200,00 em Reserva/);
  assert.match(say("quanto gastei com cinema").reply, /^Não achei gasto com Lazer em /);
  assert.match(say("quanto gastei com saude").reply, /Não achei gasto com Saúde/);
  assert.match(say("quanto gastei ontem").reply, /Não há gasto lançado ontem/);
});

test("saldo, quanto sobrou, quanto tenho livre e como estou mostram renda, gasto, guardado e livre", () => {
  for (const phrase of ["qual é meu saldo?", "qual meu saldo", "qual o meu saldo vc sabe", "quanto sobrou?", "quanto tenho livre", "como estou?", "como tô", "como to indo", "como tô de grana"]) {
    const reply = say(phrase);
    assert.equal(reply.entry, undefined, phrase);
    assert.match(reply.reply, /entrou R\$\s?5\.000,00, você gastou R\$\s?2\.230,00 e guardou R\$\s?200,00\. Livre: R\$\s?2\.570,00\./, phrase);
  }
  assert.match(say("qual meu saldo").reply, /por dia nos \d+ dias/);
});

test("maior gasto e onde gastei mais", () => {
  for (const phrase of ["maior gasto", "qual o maior gasto?", "onde gastei mais", "onde eu gastei mais?", "onde mais gastei"]) {
    const reply = say(phrase).reply;
    assert.match(reply, /Maior categoria: Moradia, R\$\s?1\.800,00, 81% do gasto\. Maior lançamento: Aluguel, R\$\s?1\.800,00/, phrase);
  }
  assert.match(interpret("maior gasto", state, sheet).reply, /Ainda não há gasto/);
});

test("quanto falta pra meta usa a reserva e nunca diz que chegou com meta zero", () => {
  const unset = interpret("quanto falta pra meta?", state, sheet);
  assert.match(unset.reply, /ainda não está definida/);
  assert.match(unset.reply, /Defina a meta no Perfil/);
  assert.doesNotMatch(unset.reply, /já chegou/);
  assert.doesNotMatch(interpret("simule se eu guardar 400", state, sheet).reply, /já chegou/);
  assert.match(interpret("simule se eu guardar 400", state, sheet).reply, /Defina a meta no Perfil/);

  const { ledger, sheet: filled } = seeded();
  const withGoal: LedgerState = { ...ledger, goals: [{ id: "goal-reserva", name: "Reserva de emergência", targetCents: 1_000_000, savedCents: 200_000, note: "" }] };
  const reply = interpret("quanto falta pra reserva", withGoal, filled).reply;
  assert.match(reply, /Faltam R\$\s?8\.000,00/);
  assert.match(reply, /20%/);
  assert.match(reply, /fecha em 40 meses/);
  assert.match(interpret("quanto falta pra meta", { ...withGoal, goals: [{ ...withGoal.goals[0], savedCents: 1_000_000 }] }, filled).reply, /já chegou na meta de R\$\s?10\.000,00/);
});

test("resumo traz três linhas curtas", () => {
  for (const phrase of ["resumo", "resumo do mês", "me dá um resumo"]) {
    const lines = say(phrase).reply.split("\n");
    assert.equal(lines.length, 3, phrase);
    assert.match(lines[0], /entrou R\$\s?5\.000,00, gastou R\$\s?2\.230,00 e guardou R\$\s?200,00\. Livre: R\$\s?2\.570,00\./);
    assert.match(lines[1], /Maior categoria: Moradia/);
  }
  assert.match(interpret("resumo", state, sheet).reply, /Ainda não há lançamentos/);
});

test("desfaz remove só o último lançamento do chat nesta planilha", () => {
  const { ledger, sheet: current } = seeded();
  const out = interpret("desfaz", ledger, current);
  const target = ledger.entries.find((entry) => entry.source === "agente");
  assert.ok(target);
  assert.equal(out.undoEntryId, target.id);
  assert.equal(out.entry, undefined);
  assert.match(out.reply, /Apaguei o último lançamento do chat: Uber, R\$\s?30,00/);
  assert.match(out.reply, /Livre agora: R\$\s?2\.600,00/);
  for (const phrase of ["desfazer", "apaga o último", "apagar último lançamento", "cancela o último", "Apagar o ultimo lancamento", "desfazer o último lançamento"]) {
    assert.equal(interpret(phrase, ledger, current).undoEntryId, target.id, phrase);
  }
  const after = removeEntries(ledger, (entry) => entry.id === out.undoEntryId);
  assert.equal(after.entries.length, ledger.entries.length - 1);
  const none = interpret("desfaz", after, current);
  assert.equal(none.undoEntryId, undefined);
  assert.match(none.reply, /Não há nada para desfazer/);
  // Lançamento manual ou de outra planilha não conta.
  assert.equal(interpret("desfaz", state, sheet).undoEntryId, undefined);
  const other = { ...ledger, sheets: [...ledger.sheets, { ...current, id: "outra", name: "Outra" }] };
  assert.equal(interpret("desfaz", other, other.sheets[1]).undoEntryId, undefined);
  // Dois lançamentos do chat: vence o mais recente.
  const two = addEntryTo(ledger, current.id, { type: "variavel", title: "Padaria", category: "Mercado", cents: 1_500, date: todayISO(), source: "agente" });
  assert.equal(interpret("desfaz", two, current).undoEntryId, two.entries.at(-1)?.id);
});

test("nenhuma pergunta ou comando cria lançamento", () => {
  const phrases = [
    "quanto gastei esse mês", "quanto gastei no mês?", "quanto gastei hoje", "quanto gastei com mercado", "quanto q gastei",
    "qual é meu saldo", "quanto sobrou", "quanto tenho livre", "como estou", "como tô?",
    "maior gasto", "onde gastei mais", "quanto falta pra meta", "quanto falta pra reserva",
    "resumo", "resumo do mês", "desfaz", "desfazer", "apaga o último", "apagar último lançamento", "cancela o último",
  ];
  const { ledger, sheet: current } = seeded();
  for (const phrase of phrases) {
    for (const [s, sh] of [[state, sheet], [ledger, current]] as const) {
      const out = interpret(phrase, s, sh);
      assert.equal(out.entry, undefined, phrase);
      assert.equal(out.csv, undefined, phrase);
      assert.ok(out.reply.length > 0, phrase);
      assert.doesNotMatch(out.reply, /—|–/, phrase);
    }
  }
});

test("lançar continua funcionando perto das palavras novas", () => {
  assert.equal(ask("saldo acumulado 500").entry?.cents, 50000);
  assert.equal(ask("gastei 50 no resumo").entry?.cents, 5000);
});

test("descrição, valor e destino curto: aporte de 400 na reserva vira investimento", () => {
  const outcome = interpret("aporte de 400 na reserva", state, sheet);
  assert.equal(outcome.entry?.type, "investimento");
  assert.equal(outcome.entry?.cents, 40000);
  assert.equal(outcome.entry?.category, "Reserva");
});
