import { hashPassword, unwrapDek, verifyPassword, wrapDek } from "@/lib/crypto";
import { requireActive } from "@/lib/access";
import { sql } from "@/lib/db";
import { asRecord, cleanPassword, jsonBody, jsonError, limited, readJson } from "@/lib/guard";
import { createSession, readSession, revokeUserSessions, sameOrigin } from "@/lib/session";

type Row = { password_salt: string; password_hash: string; wrap_salt: string; wrapped_dek: string };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Origem não aceita.");
  const session = await readSession();
  if (!session) return jsonError(401, "Entre para trocar a senha.");
  const gate = await requireActive(session.userId);
  if (gate instanceof Response) return gate;
  if (limited(`password:${session.userId}`, 8, 15 * 60 * 1000)) {
    return jsonError(429, "Muitas tentativas. Espere quinze minutos.");
  }
  const body = asRecord(await readJson(request));
  const current = typeof body?.current === "string" ? body.current : "";
  const next = cleanPassword(body?.next);
  if (!next) return jsonError(400, "A nova senha precisa ter entre 10 e 200 caracteres.");
  const rows = await sql<Row>(
    `select password_salt, password_hash, wrap_salt, wrapped_dek from users where id = $1`,
    [session.userId],
  );
  const user = rows[0];
  const passwordOk = user ? await verifyPassword(current, user.password_salt, user.password_hash).catch(() => false) : false;
  if (!user || !passwordOk) return jsonError(401, "A senha atual não confere.");
  const dek = await unwrapDek(current, user.wrap_salt, user.wrapped_dek);
  if (!dek) return jsonError(401, "A senha atual não confere.");
  const wrapped = await wrapDek(next, dek);
  const passwordRecord = await hashPassword(next);
  await sql(
    `update users set password_salt = $1, password_hash = $2, wrap_salt = $3, wrapped_dek = $4 where id = $5`,
    [passwordRecord.salt, passwordRecord.hash, wrapped.salt, wrapped.wrapped, session.userId],
  );
  await revokeUserSessions(session.userId);
  const response = jsonBody({ ok: true });
  response.headers.set("Set-Cookie", await createSession(session.userId, dek, request));
  return response;
}
