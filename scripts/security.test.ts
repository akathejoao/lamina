import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { safePhoto } from "../src/lib/photo";
import { assertParameterized } from "../src/lib/sql-guard";
import { openSessionToken, sealSessionToken } from "../src/lib/session-token";

process.env.SESSION_SECRET = "test-session-secret-value-32chars-min";

test("sql recusa literal, comentário e comando empilhado", () => {
  assert.doesNotThrow(() => assertParameterized("select email from users where id = $1"));
  assert.throws(() => assertParameterized("select * from users where email = 'a@b.c'"));
  assert.throws(() => assertParameterized("select 1; delete from users"));
  assert.throws(() => assertParameterized("select 1 -- comment"));
});

test("foto só aceita data URL de imagem raster", () => {
  const png = `data:image/png;base64,${"A".repeat(40)}==`;
  assert.equal(safePhoto(png), png);
  assert.equal(safePhoto(`data:image/svg+xml;base64,${"A".repeat(40)}`), null);
  assert.equal(safePhoto(`${png.slice(0, -2)}");`), null);
  assert.equal(safePhoto("javascript:alert(1)"), null);
  assert.equal(safePhoto(null), null);
});

test("o cookie não carrega a chave da planilha em aberto", () => {
  const dek = randomBytes(32);
  const token = sealSessionToken({
    sub: "user-1",
    sid: "session-id-0123456789abcdef",
    exp: Date.now() + 60_000,
    dek,
  });
  const body = JSON.parse(Buffer.from(token.split(".")[0] ?? "", "base64url").toString("utf8")) as {
    dek?: string;
    box?: string;
  };
  assert.equal(body.dek, undefined);
  assert.equal(typeof body.box, "string");
  assert.equal(token.includes(dek.toString("base64url")), false);
  const opened = openSessionToken(token);
  assert.equal(opened?.userId, "user-1");
  assert.equal(opened?.dek.equals(dek), true);
  assert.equal(openSessionToken(`${token.slice(0, -4)}aaaa`), null);
});

// Os testes abaixo usam o Postgres em memória (PGlite) e as migrations da pasta migrations/.
process.env.DATABASE_URL = "";

test("o limitador não conta pedido recusado e libera quando a janela vira", async () => {
  const { limited, limitedInMemory } = await import("../src/lib/guard");
  const windowMs = 60_000;
  const start = Math.floor(Date.now() / windowMs) * windowMs;
  const key = `test:${randomBytes(6).toString("hex")}`;
  const results: boolean[] = [];
  for (let i = 0; i < 8; i += 1) results.push(await limited(key, 3, windowMs, start + i));
  assert.deepEqual(results, [false, false, false, true, true, true, true, true]);
  assert.equal(await limited(key, 3, windowMs, start + windowMs + 1), false);
  assert.equal(await limited(`${key}:other`, 3, windowMs, start), false);

  // Fallback em memória: pedido recusado não empurra a janela para a frente.
  const memoryKey = `memory:${randomBytes(6).toString("hex")}`;
  assert.equal(limitedInMemory(memoryKey, 2, 100, 0), false);
  assert.equal(limitedInMemory(memoryKey, 2, 100, 1), false);
  for (let t = 10; t < 100; t += 10) assert.equal(limitedInMemory(memoryKey, 2, 100, t), true);
  assert.equal(limitedInMemory(memoryKey, 2, 100, 101), false);
});

test("o IP do limite vem do cabeçalho da Vercel, nunca de x-forwarded-for", async () => {
  const { clientIp } = await import("../src/lib/guard");
  const request = (headers: Record<string, string>) => new Request("http://localhost/api", { headers });
  assert.equal(clientIp(request({ "x-vercel-forwarded-for": "203.0.113.9, 10.0.0.1" })), "203.0.113.9");
  assert.equal(clientIp(request({ "x-real-ip": "198.51.100.4" })), "198.51.100.4");
  assert.equal(clientIp(request({})), null);
});

test("a validação da planilha recusa item ruim sem quebrar", async () => {
  const { validateLedger } = await import("../src/lib/validate");
  const { freshLedger, scrubLedger } = await import("../src/lib/fresh");
  const base = freshLedger("Maria Teste");
  const entry = {
    id: "e1",
    sheetId: "ciclo-atual",
    type: "variavel",
    title: "Mercado",
    category: "Alimentação",
    cents: -12_345,
    date: "2026-11-10",
    dueDay: null,
    installment: null,
    source: "manual",
  };
  const withEntry = (patch: Record<string, unknown>) => ({ ...base, entries: [{ ...entry, ...patch }] });
  assert.equal(validateLedger(base).ok, true);
  assert.equal(validateLedger(withEntry({})).ok, true);
  const bad: unknown[] = [
    null,
    "texto",
    [],
    { ...base, entries: "x" },
    { ...base, entries: [null] },
    { ...base, profile: null },
    withEntry({ cents: 1.5 }),
    withEntry({ cents: "100" }),
    withEntry({ cents: 1e12 }),
    withEntry({ date: "2026-02-30" }),
    withEntry({ date: "10/11/2026" }),
    withEntry({ type: "roubo" }),
    withEntry({ id: "x".repeat(65) }),
    withEntry({ title: "x".repeat(201) }),
    withEntry({ dueDay: 40 }),
    withEntry({ source: "hacker" }),
    { ...base, profile: { ...base.profile, banner: "neon" } },
    { ...base, profile: { ...base.profile, name: "x".repeat(81) } },
    { ...base, sheets: [{ ...base.sheets[0], kind: "outra" }] },
    { ...base, goals: [{ ...base.goals[0], savedCents: Number.NaN }] },
    { ...base, messages: [{ id: "m1", sheetId: "s", role: "user", text: "x".repeat(2001), at: "2026-11-10T10:00:00Z" }] },
    { ...base, messages: [{ id: "m1", sheetId: "s", role: "root", text: "oi", at: "2026-11-10T10:00:00Z" }] },
  ];
  for (const value of bad) {
    const result = validateLedger(value);
    assert.equal(result.ok, false, JSON.stringify(value)?.slice(0, 120));
    if (!result.ok) assert.match(result.message, /inválido/);
  }
  // Só sobram os campos conhecidos.
  const stripped = validateLedger(withEntry({ extra: "x" }));
  assert.equal(stripped.ok && "extra" in (stripped.ledger.entries[0] ?? {}), false);
  // O aparelho corta o texto longo antes de mandar, então nunca cai na recusa.
  const long = scrubLedger(withEntry({ title: "x".repeat(500) }) as typeof base);
  assert.equal(long.entries[0]?.title.length, 200);
  assert.equal(validateLedger(long).ok, true);
});

test("scrypt: o hash antigo ainda confere e o novo usa o formato com versão", async () => {
  const { createCipheriv, scryptSync } = await import("node:crypto");
  const { hashPassword, newDek, passwordHashIsLegacy, unwrapDek, verifyPassword, wrapDek, wrappedDekIsLegacy } = await import("../src/lib/crypto");
  const password = "uma senha longa de teste";

  const salt = randomBytes(16);
  const legacyHash = scryptSync(password, salt, 32).toString("base64url");
  assert.equal(passwordHashIsLegacy(legacyHash), true);
  assert.equal(await verifyPassword(password, salt.toString("base64url"), legacyHash), true);
  assert.equal(await verifyPassword("outra senha", salt.toString("base64url"), legacyHash), false);

  const dek = newDek();
  const wrapSalt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", scryptSync(password, wrapSalt, 32), iv);
  const body = Buffer.concat([cipher.update(dek), cipher.final()]);
  const legacyWrapped = [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(".");
  assert.equal(wrappedDekIsLegacy(legacyWrapped), true);
  assert.equal((await unwrapDek(password, wrapSalt.toString("base64url"), legacyWrapped))?.equals(dek), true);
  assert.equal(await unwrapDek("outra senha", wrapSalt.toString("base64url"), legacyWrapped), null);

  const fresh = await hashPassword(password);
  assert.equal(fresh.hash.startsWith("v2:"), true);
  assert.equal(passwordHashIsLegacy(fresh.hash), false);
  assert.equal(await verifyPassword(password, fresh.salt, fresh.hash), true);
  assert.equal(await verifyPassword("outra senha", fresh.salt, fresh.hash), false);
  const wrapped = await wrapDek(password, dek);
  assert.equal(wrapped.wrapped.startsWith("v2:"), true);
  assert.equal(wrappedDekIsLegacy(wrapped.wrapped), false);
  assert.equal((await unwrapDek(password, wrapped.salt, wrapped.wrapped))?.equals(dek), true);
  assert.equal(await unwrapDek("outra senha", wrapped.salt, wrapped.wrapped), null);
  // Etiqueta GCM de tamanho errado é recusada antes de decifrar.
  const [vIv, , vBody] = wrapped.wrapped.slice(3).split(".");
  assert.equal(await unwrapDek(password, wrapped.salt, `v2:${vIv}.AAAA.${vBody}`), null);
});

test("health público mostra só ok e database", async () => {
  const { GET } = await import("../src/app/api/health/route");
  const response = await GET();
  const body = (await response.json()) as Record<string, unknown>;
  assert.deepEqual(Object.keys(body).sort(), ["database", "ok"]);
  assert.equal(body.database, false);
  assert.equal(body.ok, false);
  assert.equal(response.status, 503);
});
