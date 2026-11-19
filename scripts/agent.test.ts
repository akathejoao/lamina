import assert from "node:assert/strict";
import { test } from "node:test";
import { interpret } from "../src/lib/agent";
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

  const pizza = interpret("100 reais de pizza", state, sheet);
  assert.equal(pizza.entry?.category, "Outros");
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
