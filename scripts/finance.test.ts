import assert from "node:assert/strict";
import { test } from "node:test";
import { interpret } from "../src/lib/agent";
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
