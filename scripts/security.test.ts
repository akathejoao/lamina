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
