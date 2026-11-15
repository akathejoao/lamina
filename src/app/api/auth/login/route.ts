import { unwrapDek, verifyPassword } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { asRecord, cleanEmail, cleanPassword, jsonError, limited, readJson } from "@/lib/guard";
import { clientKey, sameOrigin, sealSession, sessionCookie } from "@/lib/session";

type UserRow = {
  id: string;
  password_salt: string;
  password_hash: string;
  wrap_salt: string;
  wrapped_dek: string;
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Origem não aceita.");
  const key = `login:${clientKey(request)}`;
  if (limited(key, 8, 15 * 60 * 1000)) {
    return jsonError(429, "Muitas tentativas. Espere quinze minutos.");
  }
  const body = asRecord(await readJson(request));
  const email = cleanEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !cleanPassword(password)) {
    return jsonError(401, "E-mail ou senha não conferem.");
  }
  const rows = await sql<UserRow>(
    `select id, password_salt, password_hash, wrap_salt, wrapped_dek from users where email = $1`,
    [email],
  );
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_salt, user.password_hash))) {
    return jsonError(401, "E-mail ou senha não conferem.");
  }
  const dek = await unwrapDek(password, user.wrap_salt, user.wrapped_dek);
  if (!dek) return jsonError(401, "E-mail ou senha não conferem.");
  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", sessionCookie(sealSession(user.id, dek), request));
  return response;
}
