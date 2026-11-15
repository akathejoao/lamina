import { hashPassword, unwrapDek, verifyPassword, wrapDek } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { asRecord, cleanPassword, jsonError, readJson } from "@/lib/guard";
import { readSession, sameOrigin } from "@/lib/session";

type Row = { password_salt: string; password_hash: string; wrap_salt: string; wrapped_dek: string };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Origem não aceita.");
  const session = await readSession();
  if (!session) return jsonError(401, "Entre para trocar a senha.");
  const body = asRecord(await readJson(request));
  const current = typeof body?.current === "string" ? body.current : "";
  const next = cleanPassword(body?.next);
  if (!next) return jsonError(400, "A nova senha precisa ter entre 10 e 200 caracteres.");
  const rows = await sql<Row>(
    `select password_salt, password_hash, wrap_salt, wrapped_dek from users where id = $1`,
    [session.userId],
  );
  const user = rows[0];
  if (!user || !(await verifyPassword(current, user.password_salt, user.password_hash))) {
    return jsonError(401, "A senha atual não confere.");
  }
  const dek = await unwrapDek(current, user.wrap_salt, user.wrapped_dek);
  if (!dek) return jsonError(401, "A senha atual não confere.");
  const wrapped = await wrapDek(next, dek);
  const passwordRecord = await hashPassword(next);
  await sql(
    `update users set password_salt = $1, password_hash = $2, wrap_salt = $3, wrapped_dek = $4 where id = $5`,
    [passwordRecord.salt, passwordRecord.hash, wrapped.salt, wrapped.wrapped, session.userId],
  );
  return Response.json({ ok: true });
}
