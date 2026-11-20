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
