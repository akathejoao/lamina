import { randomUUID } from "node:crypto";
import { PRIVACY_VERSION, TERMS_VERSION, encryptJson, hashPassword, newDek, wrapDek } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { freshLedger } from "@/lib/fresh";
import { asRecord, cleanEmail, cleanName, cleanPassword, jsonError, limited, readJson } from "@/lib/guard";
import { isDesignatedAdmin } from "@/lib/admin";
import { clientKey, sameOrigin, sealSession, sessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Origem não aceita.");
  if (limited(`register:${clientKey(request)}`, 5, 60 * 60 * 1000)) {
    return jsonError(429, "Muitas tentativas. Espere um pouco e tente de novo.");
  }
  const body = asRecord(await readJson(request));
  const name = cleanName(body?.name);
  const email = cleanEmail(body?.email);
  const password = cleanPassword(body?.password);
  const consent = body?.consent === true;
  const adult = body?.adult === true;
  if (!name || !email || !password) {
    return jsonError(400, "Use nome, e-mail válido e uma senha com pelo menos 10 caracteres.");
  }
  if (!adult || !consent) {
    return jsonError(400, "Para criar a conta, confirme a idade e o consentimento.");
  }
  const dek = newDek();
  const wrapped = await wrapDek(password, dek);
  const passwordRecord = await hashPassword(password);
  const id = randomUUID();
  const ledger = encryptJson(dek, freshLedger(name));
  const role = isDesignatedAdmin(email) ? "admin" : "user";
  try {
    await sql(
      `insert into users (id, email, name, password_salt, password_hash, wrap_salt, wrapped_dek, terms_version, privacy_version, consent_at, role)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10)`,
      [id, email, name, passwordRecord.salt, passwordRecord.hash, wrapped.salt, wrapped.wrapped, TERMS_VERSION, PRIVACY_VERSION, role],
    );
    await sql(`insert into ledgers (user_id, ciphertext) values ($1, $2)`, [id, ledger]);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505" || String(error).toLowerCase().includes("unique")) {
      return jsonError(409, "Já existe uma conta com esse e-mail. Entre com ela.");
    }
    console.error("register failed", error);
    return jsonError(500, "Não foi possível criar a conta.");
  }
  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", sessionCookie(sealSession(id, dek), request));
  return response;
}
