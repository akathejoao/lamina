import assert from "node:assert/strict";
import { test } from "node:test";
import { interpret } from "../src/lib/agent";
import { decodeCsvBytes, entriesToCsv } from "../src/lib/csv";
import { mathFor, readCsv, tips } from "../src/lib/finance";
import { freshLedger } from "../src/lib/fresh";
import { seedState, NOVEMBER } from "../src/lib/seed";
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
  for (const line of tips(seedState, seedNov, "2026-11-19")) assert.doesNotMatch(line, /semanas/);
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
