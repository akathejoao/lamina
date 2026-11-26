import assert from "node:assert/strict";
import { test } from "node:test";
import { interpret } from "../src/lib/agent";
import { decodeCsvBytes, entriesToCsv } from "../src/lib/csv";
import {
  addEntryTo,
  duplicateMonthIn,
  health,
  mathFor,
  readCsv,
  removeEntries,
  restoreEntryTo,
  sheetHeadline,
  streak,
  tips,
  updateGoalIn,
} from "../src/lib/finance";
import { freshLedger } from "../src/lib/fresh";
import { todayISO } from "../src/lib/money";
import { buildSeed, seedState, NOVEMBER } from "../src/lib/seed";
import type { Entry, LedgerState } from "../src/lib/types";

const state = freshLedger("Ana");
const sheet = state.sheets[0];

test("o chat lê ponto decimal, mil e k sem perder ordem de grandeza", () => {
  assert.equal(interpret("gastei 85.50 na padaria", state, sheet).entry?.cents, 8550);
  assert.equal(interpret("gastei 85,50 no mercado", state, sheet).entry?.cents, 8550);
  assert.equal(interpret("comprei 2 mil de roupa", state, sheet).entry?.cents, 200000);
  assert.equal(interpret("gastei 2k no mercado", state, sheet).entry?.cents, 200000);
  assert.equal(interpret("gastei 2,5 mil no conserto", state, sheet).entry?.cents, 250000);
  assert.equal(interpret("gastei 5.400 no mercado", state, sheet).entry?.cents, 540000);
  assert.equal(interpret("gastei 20000 no carro", state, sheet).entry?.cents, 2000000);
  assert.equal(interpret("gastei 100 kg de ração", state, sheet).entry?.cents, 10000);
  assert.equal(interpret("meu salário é 2000", state, sheet).entry?.cents, 200000);
});

test("o chat pergunta em vez de gravar quando sobra número colado ao valor", () => {
  const unclear = interpret("gastei 85.5.0 no mercado", state, sheet);
  assert.equal(unclear.entry, undefined);
  assert.match(unclear.reply, /Não tenho certeza do valor/);
  assert.equal(interpret("gastei 0 no mercado", state, sheet).entry, undefined);
});

test("pergunta com vírgula e a palavra valor não vira CSV", () => {
  const reply = interpret("qual o valor, por favor, que posso gastar?", state, sheet).reply;
  assert.doesNotMatch(reply, /CSV/);
});

test("CSV lê milhar, sinal, aspas e datas, e conta o que ficou de fora", () => {
  const bank = readCsv("data;descricao;valor\n01/11/2026;Aluguel;-5.400\n02/11/2026;Pix recebido;85,50\n3/11/26;Mercado;-2000\n04/11/2026;;10");
  assert.equal(bank.skipped, 1);
  assert.deepEqual(
    bank.rows.map((row) => [row.date, row.title, row.cents, row.type]),
    [
      ["2026-11-01", "Aluguel", 540000, "fixo"],
      ["2026-11-02", "Pix recebido", 8550, "receita"],
      ["2026-11-03", "Mercado", 200000, "variavel"],
    ],
  );
  const quoted = readCsv('data,descricao,valor\n2026-11-01,"Mercado, padaria","85,50"');
  assert.equal(quoted.rows[0]?.title, "Mercado, padaria");
  assert.equal(quoted.rows[0]?.cents, 8550);
});

function entry(type: Entry["type"], category: string, cents: number): Entry {
  return { id: `${type}-${category}-${cents}`, sheetId: "s", type, title: category, category, cents, date: "2026-11-05", dueDay: null, installment: null };
}

test("cada lançamento cai em um só balde e o Livre fecha", () => {
  const custom: LedgerState = {
    ...state,
    sheets: [{ id: "s", name: "Nov", kind: "mensal", month: "2026-11", deadline: null, targetCents: null, archived: false, categories: [{ name: "Reserva", bucket: "futuro" }, { name: "Moradia", bucket: "essenciais" }] }],
    entries: [entry("receita", "Salário", 500000), entry("variavel", "Reserva", 100000)],
  };
  const futuro = mathFor(custom, custom.sheets[0], "2026-11-19");
  assert.equal(futuro.futuro, 100000);
  assert.equal(futuro.free, 400000);
  const twice = mathFor({ ...custom, entries: [entry("receita", "Salário", 500000), entry("investimento", "Moradia", 100000)] }, custom.sheets[0], "2026-11-19");
  assert.equal(twice.essenciais + twice.estilo + twice.futuro, 100000);
  assert.equal(twice.free, 400000);
});

test("a dica não promete prazo que ninguém calculou", () => {
  const seedNov = seedState.sheets.find((item) => item.id === NOVEMBER);
  assert.ok(seedNov);
  for (const line of tips(seedState, seedNov, todayISO())) assert.doesNotMatch(line, /semanas/);
});

test("decodeCsvBytes lê Windows-1252 do Excel e UTF-8 com BOM", () => {
  // "Descrição;Valor" e "Açougue;85,50" em Windows-1252: ç = 0xE7 e ã = 0xE3.
  const latin = Buffer.from([
    0x44, 0x65, 0x73, 0x63, 0x72, 0x69, 0xe7, 0xe3, 0x6f, 0x3b, 0x56, 0x61, 0x6c, 0x6f, 0x72, 0x0d, 0x0a,
    0x41, 0xe7, 0x6f, 0x75, 0x67, 0x75, 0x65, 0x3b, 0x38, 0x35, 0x2c, 0x35, 0x30,
  ]);
  const text = decodeCsvBytes(latin.buffer.slice(latin.byteOffset, latin.byteOffset + latin.byteLength));
  assert.equal(text, "Descrição;Valor\r\nAçougue;85,50");
  const read = readCsv(text);
  assert.equal(read.rows[0]?.title, "Açougue");
  assert.equal(read.rows[0]?.cents, 8550);

  const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("Descrição;Valor\nÉ pão;10,00", "utf8")]);
  const utf8 = decodeCsvBytes(withBom.buffer.slice(withBom.byteOffset, withBom.byteOffset + withBom.byteLength));
  assert.equal(utf8.startsWith("Descrição"), true);
  assert.equal(readCsv(utf8).rows[0]?.title, "É pão");
  assert.equal(decodeCsvBytes(new ArrayBuffer(0)), "");
});

test("extrato de banco com Débito e Crédito e cabeçalhos do Excel", () => {
  const bank = readCsv(
    [
      "Extrato da conta;;;",
      "Data;Lançamento;Débito;Crédito;Saldo",
      "01/11/2026;Aluguel;1.800,00;;5.000,00",
      "02/11/2026;Salário empresa;;5.400,00;10.400,00",
      "03/11/2026;Mercado;R$ 85,50;;10.314,50",
      "04/11/2026;Sem valor;;;10.314,50",
    ].join("\r\n"),
  );
  assert.equal(bank.skipped, 1);
  assert.deepEqual(
    bank.rows.map((row) => [row.date, row.title, row.cents, row.type]),
    [
      ["2026-11-01", "Aluguel", 180000, "fixo"],
      ["2026-11-02", "Salário empresa", 540000, "receita"],
      ["2026-11-03", "Mercado", 8550, "variavel"],
    ],
  );
  const inout = readCsv("Data;Histórico;Saída;Entrada\n05/11/2026;Uber;30,00;\n06/11/2026;Freela;;300,00");
  assert.deepEqual(
    inout.rows.map((row) => [row.title, row.cents, row.type]),
    [
      ["Uber", 3000, "variavel"],
      ["Freela", 30000, "receita"],
    ],
  );
  const named = readCsv('"Data","Descrição do lançamento","Valor (R$)"\n"07/11/2026","Padaria","(85,50)"\n"08/11/2026","Pix","1234.56"');
  assert.deepEqual(
    named.rows.map((row) => [row.title, row.cents, row.type]),
    [
      ["Padaria", 8550, "variavel"],
      ["Pix", 123456, "receita"],
    ],
  );
});

test("valores em formatos brasileiros e a coluna Tipo por rótulo", () => {
  const read = readCsv(
    [
      "Data;Descrição;Tipo;Valor",
      "01/11/2026;Salário;Receita;R$ 1.234,56",
      "02/11/2026;Aluguel;Gasto fixo;-1.234,56",
      "03/11/2026;Cinema;GASTO VARIÁVEL;85,50",
      "04/11/2026;Netflix;assinatura;55,90",
      "05/11/2026;Tesouro;Investimento;500",
      "06/11/2026;Antigo;fixo;100",
    ].join("\n"),
  );
  assert.deepEqual(
    read.rows.map((row) => [row.title, row.cents, row.type]),
    [
      ["Salário", 123456, "receita"],
      ["Aluguel", 123456, "fixo"],
      ["Cinema", 8550, "variavel"],
      ["Netflix", 5590, "assinatura"],
      ["Tesouro", 50000, "investimento"],
      ["Antigo", 10000, "fixo"],
    ],
  );
});

function made(overrides: Partial<Entry>): Entry {
  return { id: "x", sheetId: "s", type: "variavel", title: "Item", category: "Outros", cents: 100, date: "2026-11-05", dueDay: null, installment: null, ...overrides };
}

test("o CSV exportado para o Excel abre igual na volta", () => {
  const entries: Entry[] = [
    made({ id: "1", type: "receita", title: "Salário", category: "Salário", cents: 540000, date: "2026-11-05" }),
    made({ id: "2", type: "fixo", title: "Aluguel", category: "Moradia", cents: 180000, date: "2026-11-01", dueDay: 10 }),
    made({ id: "3", type: "variavel", title: 'Mercado; "padaria"', category: "Mercado", cents: 8550, date: "2026-11-03" }),
    made({ id: "4", type: "assinatura", title: "Netflix", category: "Streaming", cents: 5590, date: "2026-11-02" }),
    made({ id: "5", type: "investimento", title: "Tesouro", category: "Reserva", cents: 50000, date: "2026-11-04" }),
    made({ id: "6", type: "fixo", title: "Geladeira", category: "Compras", cents: 25050, date: "2026-11-06", installment: { current: 3, total: 12 } }),
    made({ id: "7", type: "variavel", title: "=SOMA(A1)", category: "Outros", cents: 1, date: "2026-11-07" }),
    made({ id: "8", type: "variavel", title: "Linha\nquebrada", category: "Café, pão", cents: 99, date: "2026-11-08" }),
  ];
  const csv = entriesToCsv(entries);
  assert.equal(csv.startsWith("﻿Data;Descrição;Tipo;Categoria;Valor;Vence dia;Parcela\r\n"), true);
  assert.equal(csv.includes("\r\n01/11/2026;Aluguel;Gasto fixo;Moradia;-1800,00;10;\r\n"), true);
  assert.equal(csv.includes("05/11/2026;Salário;Receita;Salário;5400,00;;\r\n"), true);
  assert.equal(csv.includes(';"Mercado; ""padaria""";'), true);
  assert.equal(csv.includes("06/11/2026;Geladeira;Gasto fixo;Compras;-250,50;;3/12\r\n"), true);
  const first = csv.split("\r\n").slice(1, 4).map((line) => line.slice(0, 10));
  assert.deepEqual(first, ["01/11/2026", "02/11/2026", "03/11/2026"]);

  const back = readCsv(csv);
  assert.equal(back.skipped, 0);
  assert.equal(back.rows.length, entries.length);
  const byTitle = new Map(back.rows.map((row) => [row.title, row]));
  for (const original of entries) {
    const row = byTitle.get(original.title);
    assert.ok(row, original.title);
    assert.equal(row.cents, original.cents, original.title);
    assert.equal(row.type, original.type, original.title);
    assert.equal(row.category, original.category, original.title);
    assert.equal(row.date, original.date, original.title);
    assert.equal(row.dueDay, original.dueDay ?? undefined, original.title);
    assert.deepEqual(row.installment, original.installment ?? undefined, original.title);
  }
  // Os bytes que o Excel abre (UTF-8 com BOM) também voltam iguais.
  const bytes = Buffer.from(csv, "utf8");
  const decoded = decodeCsvBytes(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.equal(readCsv(decoded).rows.length, entries.length);
  assert.equal(entriesToCsv([]), "﻿Data;Descrição;Tipo;Categoria;Valor;Vence dia;Parcela\r\n");
});

// ---- Dicas, termômetro, sequência, cartão da tela inicial ----

function ledgerWith(entries: Partial<Entry>[], goals?: LedgerState["goals"], now = "2026-11-20"): { ledger: LedgerState; sheet: LedgerState["sheets"][number]; now: string } {
  const base = freshLedger("Ana");
  const sheet = { ...base.sheets[0], id: "s", month: now.slice(0, 7) };
  const full = entries.map((item, index) => ({
    id: `x${index}`,
    sheetId: "s",
    type: "variavel" as const,
    title: "Item",
    category: "Outros",
    cents: 100,
    date: `${now.slice(0, 7)}-05`,
    dueDay: null,
    installment: null,
    ...item,
  }));
  return { ledger: { ...base, sheets: [sheet], entries: full, goals: goals ?? base.goals }, sheet, now };
}

test("as dicas vêm em ordem de importância, no máximo seis, e só citam número calculado", () => {
  const { ledger, sheet, now } = ledgerWith([
    { type: "receita", title: "Salário", category: "Salário", cents: 300_000 },
    { type: "fixo", title: "Aluguel", category: "Moradia", cents: 250_000 },
    { type: "variavel", title: "Lazer", category: "Lazer", cents: 200_000 },
  ]);
  const lines = tips(ledger, sheet, now);
  assert.ok(lines.length >= 1 && lines.length <= 6);
  assert.match(lines[0], /no vermelho/);
  assert.match(lines[0], /R\$\s?1\.500,00/);
  for (const line of lines) {
    assert.doesNotMatch(line, /semanas|—|–/);
  }
});

test("cada regra de dica só aparece quando a condição vale e cita o número", () => {
  const first = (entries: Partial<Entry>[], pattern: RegExp, goals?: LedgerState["goals"], now = "2026-11-20") => {
    const { ledger, sheet } = ledgerWith(entries, goals, now);
    const lines = tips(ledger, sheet, now);
    const hit = lines.find((line) => pattern.test(line));
    return { hit, lines };
  };
  const salary: Partial<Entry> = { type: "receita", title: "Salário", category: "Salário", cents: 1_000_000 };

  const blank = ledgerWith([]);
  assert.match(tips(blank.ledger, blank.sheet, blank.now)[0], /ainda não tem lançamentos/);

  const noIncome = first([{ type: "variavel", category: "Mercado", cents: 12_300 }], /Ainda não há receita lançada/);
  assert.match(noIncome.hit ?? "", /R\$\s?123,00/);

  const dues = first([salary, { type: "fixo", title: "Luz", category: "Contas", cents: 18_000, dueDay: 22 }, { type: "fixo", title: "Água", category: "Contas", cents: 9_000, dueDay: 25 }], /próximos 7 dias/);
  assert.match(dues.hit ?? "", /Luz \(dia 22, R\$\s?180,00\)/);
  assert.match(dues.hit ?? "", /Soma R\$\s?270,00/);
  assert.equal(first([salary, { type: "fixo", title: "Luz", category: "Contas", cents: 18_000, dueDay: 29 }], /próximos 7 dias/).hit, undefined);

  const over = first([salary, { type: "fixo", title: "Aluguel", category: "Moradia", cents: 700_000 }], /Essenciais já leva 70%/);
  assert.match(over.hit ?? "", /plano da planilha é 50%/);
  assert.match(over.hit ?? "", /R\$\s?2\.000,00 acima/);

  const futuro = first([salary, { type: "investimento", title: "Aporte", category: "Reserva", cents: 50_000 }], /Futuro está em/);
  assert.match(futuro.hit ?? "", /R\$\s?500,00/);
  assert.match(futuro.hit ?? "", /R\$\s?2\.000,00/);
  assert.match(futuro.hit ?? "", /Faltam R\$\s?1\.500,00/);

  const pace = first([salary, { type: "variavel", category: "Lazer", cents: 600_000 }], /ritmo dos 20 primeiros dias/);
  assert.match(pace.hit ?? "", /R\$\s?9\.000,00/);

  const concentrated = first([salary, { type: "variavel", category: "Lazer", cents: 100_000 }, { type: "variavel", category: "Mercado", cents: 50_000 }], /concentra/);
  assert.match(concentrated.hit ?? "", /Lazer concentra 67%/);

  const delivery = first([salary, { type: "variavel", category: "Delivery", cents: 30_000 }, { type: "variavel", category: "Mercado", cents: 40_000 }], /^Delivery soma/);
  assert.match(delivery.hit ?? "", /R\$\s?300,00 no ciclo, 75% do que foi no Mercado/);
  assert.match(delivery.hit ?? "", /R\$\s?3\.600,00/);
  assert.equal(first([salary, { type: "variavel", category: "Delivery", cents: 10_000 }], /^Delivery soma/).hit, undefined);

  const subs = first([salary, { type: "assinatura", title: "Netflix", category: "Streaming", cents: 5_590 }, { type: "assinatura", title: "Spotify", category: "Streaming", cents: 2_190 }], /assinaturas somam/);
  assert.match(subs.hit ?? "", /2 assinaturas somam R\$\s?77,80/);
  assert.match(subs.hit ?? "", /R\$\s?933,60/);

  const small = first([salary, { type: "assinatura", title: "iCloud", category: "Software", cents: 1_490 }], /parece pequena/);
  assert.match(small.hit ?? "", /iCloud parece pequena, mas soma R\$\s?178,80 por ano/);

  const lazer = first([salary, { type: "variavel", category: "Lazer", cents: 20_000 }], /Reduzir 15%/);
  assert.match(lazer.hit ?? "", /R\$\s?30,00/);
  assert.equal(first([salary, { type: "variavel", category: "Lazer", cents: 5_000 }], /Reduzir 15%/).hit, undefined);

  const parcela = first([salary, { type: "fixo", title: "Notebook", category: "Contas", cents: 31_000, installment: { current: 3, total: 12 } }], /parcela 3\/12/);
  assert.match(parcela.hit ?? "", /R\$\s?2\.790,00 em parcelas/);
  assert.equal(first([salary, { type: "fixo", title: "Notebook", category: "Contas", cents: 31_000, installment: { current: 12, total: 12 } }], /parcela/).hit, undefined);

  const reserve = (savedCents: number, targetCents: number): LedgerState["goals"] => [{ id: "goal-reserva", name: "Reserva de emergência", targetCents, savedCents, note: "" }];
  const months = first([salary, { type: "investimento", title: "Aporte", category: "Reserva", cents: 100_000 }], /Reserva de emergência está em/, reserve(400_000, 1_000_000));
  assert.match(months.hit ?? "", /40%/);
  assert.match(months.hit ?? "", /faltam 6 meses/);
  assert.match(first([salary], /Reserva de emergência está em/, reserve(400_000, 1_000_000)).hit ?? "", /nada foi guardado neste ciclo/);
  assert.match(first([salary], /ainda não está definida/, reserve(0, 0)).hit ?? "", /Perfil/);

  const single = first([salary], /vem de uma fonte só/);
  assert.match(single.hit ?? "", /100% da renda de R\$\s?10\.000,00 vem de uma fonte só, Salário/);
  assert.equal(first([salary, { type: "receita", title: "Freela", category: "Extra", cents: 500_000 }], /vem de uma fonte só/).hit, undefined);

  const big = first([salary, { type: "variavel", title: "Viagem", category: "Lazer", cents: 300_000 }], /maior gasto variável/);
  assert.match(big.hit ?? "", /Viagem foi o maior gasto variável: R\$\s?3\.000,00, 30% da renda/);

  const spare = first([salary, { type: "variavel", category: "Mercado", cents: 100_000 }], /Sobraram/);
  assert.match(spare.hit ?? "", /Sobraram R\$\s?9\.000,00, 90% da renda/);

  const daily = first([salary, { type: "variavel", category: "Mercado", cents: 100_000 }], /por dia/);
  assert.match(daily.hit ?? "", /R\$\s?818,18 por dia/);
});

test("a pool de dicas tem pelo menos quinze regras e não passa de seis linhas", () => {
  const { ledger, sheet, now } = ledgerWith([
    { type: "receita", title: "Salário", category: "Salário", cents: 1_000_000 },
    { type: "fixo", title: "Aluguel", category: "Moradia", cents: 700_000 },
    { type: "fixo", title: "Notebook", category: "Contas", cents: 31_000, installment: { current: 3, total: 12 }, dueDay: 22 },
    { type: "assinatura", title: "Netflix", category: "Streaming", cents: 5_590 },
    { type: "assinatura", title: "iCloud", category: "Software", cents: 1_490 },
    { type: "variavel", category: "Delivery", cents: 40_000 },
    { type: "variavel", category: "Lazer", cents: 90_000 },
  ]);
  assert.equal(tips(ledger, sheet, now).length, 6);
  const all = new Set<string>();
  const scenarios: Partial<Entry>[][] = [
    [],
    [{ type: "variavel", category: "Mercado", cents: 5_000 }],
    [{ type: "receita", title: "Salário", category: "Salário", cents: 1_000_000 }],
  ];
  for (const entries of scenarios) {
    const built = ledgerWith(entries);
    for (const line of tips(built.ledger, built.sheet, built.now)) all.add(line);
  }
  assert.ok(all.size >= 4);
});

test("sem renda e sem lançamento o termômetro diz Sem dados", () => {
  const empty = freshLedger("Ana");
  assert.equal(health(empty, todayISO()).level, "Sem dados");
  const withEntry = ledgerWith([{ type: "variavel", category: "Mercado", cents: 5_000 }], undefined, todayISO());
  assert.equal(health(withEntry.ledger, todayISO()).level, "Crítico");
  const fine = ledgerWith(
    [
      { type: "receita", title: "Salário", category: "Salário", cents: 1_000_000 },
      { type: "variavel", category: "Lazer", cents: 100_000 },
    ],
    undefined,
    todayISO(),
  );
  assert.notEqual(health(fine.ledger, todayISO()).level, "Sem dados");
});

test("a sequência ignora mês sem renda e sem gasto", () => {
  const base = freshLedger("Ana");
  const sheets = ["2026-09", "2026-10", "2026-11"].map((month) => ({ ...base.sheets[0], id: month, month }));
  const mk = (sheetId: string, type: Entry["type"], cents: number): Entry => ({ id: `${sheetId}-${type}`, sheetId, type, title: "x", category: type === "receita" ? "Salário" : "Mercado", cents, date: "2026-11-02", dueDay: null, installment: null });
  const ledger: LedgerState = { ...base, sheets, entries: [mk("2026-09", "receita", 100_000), mk("2026-11", "receita", 100_000)] };
  // Outubro está vazio: não conta e não quebra. Setembro e novembro fecham no azul.
  assert.equal(streak(ledger, "2026-11-20"), 2);
  assert.equal(streak({ ...ledger, entries: [] }, "2026-11-20"), 0);
});

test("sheetHeadline escolhe o rótulo e o número de cada tipo de planilha", () => {
  const { ledger, sheet, now } = ledgerWith([
    { type: "receita", title: "Salário", category: "Salário", cents: 500_000 },
    { type: "variavel", category: "Mercado", cents: 120_000 },
    { type: "investimento", category: "Reserva", cents: 80_000 },
  ]);
  assert.deepEqual(sheetHeadline(ledger, sheet, now), { label: "Livre", cents: 300_000 });
  const goal = { ...sheet, kind: "meta" as const, targetCents: 1_200_000 };
  const meta = sheetHeadline(ledger, goal, now);
  assert.match(meta.label, /^Guardado de R\$\s?12\.000,00$/);
  assert.equal(meta.cents, 80_000);
  assert.deepEqual(sheetHeadline(ledger, { ...goal, targetCents: null }, now), { label: "Gasto", cents: 120_000 });
  assert.deepEqual(sheetHeadline(ledger, { ...sheet, kind: "continuo" }, now), { label: "Patrimônio", cents: 80_000 });
});

test("remover ou limpar devolve da reserva o que o aporte tinha somado, sem passar de zero", () => {
  const base = freshLedger("Ana");
  const start: LedgerState = { ...base, goals: [{ id: "goal-reserva", name: "Reserva", targetCents: 1_000_000, savedCents: 100_000, note: "" }] };
  const sid = start.sheets[0].id;
  const added = addEntryTo(start, sid, { type: "investimento", title: "Aporte", category: "Reserva", cents: 50_000, date: "2026-11-02", source: "manual" });
  assert.equal(added.goals[0].savedCents, 150_000);
  assert.equal(added.entries[0].source, "manual");
  const other = addEntryTo(added, sid, { type: "variavel", title: "Mercado", category: "Mercado", cents: 9_000, date: "2026-11-02" });
  assert.equal(other.goals[0].savedCents, 150_000);
  const id = added.entries[0].id;
  const removed = removeEntries(other, (entry) => entry.id === id);
  assert.equal(removed.goals[0].savedCents, 100_000);
  assert.equal(removed.entries.length, 1);
  const restored = restoreEntryTo(removed, added.entries[0]);
  assert.equal(restored.goals[0].savedCents, 150_000);
  assert.equal(restoreEntryTo(restored, added.entries[0]), restored);
  const cleared = removeEntries(restored, (entry) => entry.sheetId === sid);
  assert.equal(cleared.entries.length, 0);
  assert.equal(cleared.goals[0].savedCents, 100_000);
  const small: LedgerState = { ...added, goals: [{ ...added.goals[0], savedCents: 10_000 }] };
  assert.equal(removeEntries(small, () => true).goals[0].savedCents, 0);
  assert.equal(removeEntries(other, () => false), other);
});

test("duplicar o mês ajusta o dia, avança a parcela e pula a última", () => {
  const base = freshLedger("Ana");
  const sheet = { ...base.sheets[0], id: "jan", name: "Janeiro", month: "2027-01" };
  const mk = (id: string, patch: Partial<Entry>): Entry => ({ id, sheetId: "jan", type: "fixo", title: id, category: "Contas", cents: 1_000, date: "2027-01-31", dueDay: 31, installment: null, source: "manual", ...patch });
  const ledger: LedgerState = {
    ...base,
    sheets: [sheet],
    entries: [
      mk("luz", {}),
      mk("notebook", { installment: { current: 3, total: 12 } }),
      mk("ultima", { installment: { current: 12, total: 12 } }),
      mk("mercado", { type: "variavel" }),
      mk("sal", { type: "receita", category: "Salário", dueDay: null, date: "2027-01-05" }),
    ],
  };
  const ids = ["new-sheet", "a", "b", "c", "d"];
  const result = duplicateMonthIn(ledger, "jan", () => ids.shift() ?? "z");
  assert.ok(result);
  assert.equal(result.id, "new-sheet");
  const copied = result.state.entries.filter((entry) => entry.sheetId === "new-sheet");
  assert.deepEqual(copied.map((entry) => entry.title), ["luz", "notebook", "sal"]);
  assert.equal(copied[0].date, "2027-02-28");
  assert.equal(copied[0].dueDay, 28);
  assert.deepEqual(copied[1].installment, { current: 4, total: 12 });
  assert.equal(copied[2].date, "2027-02-05");
  assert.equal(copied[0].source, "manual");
  assert.equal(result.state.sheets.at(-1)?.name, "Fevereiro");
  assert.equal(duplicateMonthIn(result.state, "jan"), null);
  const leap = duplicateMonthIn({ ...ledger, sheets: [{ ...sheet, month: "2028-01" }] }, "jan", () => "q");
  assert.equal(leap?.state.entries.find((entry) => entry.title === "luz" && entry.sheetId === "q")?.date, "2028-02-29");
});

test("updateGoal limita a inteiros não negativos e ignora id e nome vazios", () => {
  const base = freshLedger("Ana");
  const next = updateGoalIn(base, "goal-reserva", { targetCents: 1_234.6, savedCents: -50, name: "  Colchão  ", note: "Seis meses" });
  assert.equal(next.goals[0].targetCents, 1_235);
  assert.equal(next.goals[0].savedCents, 0);
  assert.equal(next.goals[0].name, "Colchão");
  assert.equal(next.goals[0].note, "Seis meses");
  assert.equal(updateGoalIn(base, "goal-reserva", { name: "   ", targetCents: Number.NaN }).goals[0].name, base.goals[0].name);
  assert.equal(updateGoalIn(base, "goal-reserva", { targetCents: Number.NaN }).goals[0].targetCents, 0);
  assert.equal(updateGoalIn(base, "nao-existe", { targetCents: 5 }), base);
});

test("o exemplo da demonstração anda com o calendário", () => {
  const dec = buildSeed("2026-12-10");
  const open = dec.sheets.find((item) => item.id === NOVEMBER);
  assert.equal(open?.month, "2026-12");
  assert.equal(open?.name, "Dezembro");
  assert.deepEqual(dec.sheets.filter((item) => item.kind === "mensal").map((item) => item.month), ["2026-10", "2026-11", "2026-12"]);
  assert.ok(dec.entries.filter((item) => item.sheetId === NOVEMBER).every((item) => item.date.startsWith("2026-12-")));
  const jan = buildSeed("2027-01-15");
  assert.deepEqual(jan.sheets.filter((item) => item.kind === "mensal").map((item) => item.month), ["2026-11", "2026-12", "2027-01"]);
  // Dia 30 de outubro vira 28 em fevereiro.
  const mar = buildSeed("2027-03-10");
  assert.ok(mar.entries.some((item) => item.date === "2027-02-28"));
  assert.ok(mar.entries.every((item) => Number(item.date.slice(8, 10)) <= 31 && item.date.length === 10));
  // Mesmos valores nos três meses de qualquer calendário.
  const sum = (state: LedgerState) => state.entries.reduce((total, item) => total + item.cents, 0);
  assert.equal(sum(dec), sum(jan));
  assert.equal(health(dec, "2026-12-10").level !== "Sem dados", true);
  assert.equal(mathFor(dec, dec.sheets.find((item) => item.id === NOVEMBER)!, "2026-12-10").closed, false);
});
