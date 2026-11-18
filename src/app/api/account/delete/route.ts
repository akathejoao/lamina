import { verifyPassword } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { asRecord, jsonBody, jsonError, limited, readJson } from "@/lib/guard";
import { destroySession, readSession, sameOrigin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Origem não aceita.");
  const session = await readSession();
  if (!session) return jsonError(401, "Entre para apagar a conta.");
  if (limited(`delete:${session.userId}`, 8, 15 * 60 * 1000)) {
    return jsonError(429, "Muitas tentativas. Espere quinze minutos.");
  }
  const body = asRecord(await readJson(request));
  const password = typeof body?.password === "string" ? body.password : "";
  const rows = await sql<{ password_salt: string; password_hash: string }>(
    `select password_salt, password_hash from users where id = $1`,
    [session.userId],
  );
  const user = rows[0];
  const passwordOk = user ? await verifyPassword(password, user.password_salt, user.password_hash).catch(() => false) : false;
  if (!user || !passwordOk) return jsonError(401, "A senha não confere.");
  await sql(`delete from users where id = $1`, [session.userId]);
  const response = jsonBody({ ok: true });
  response.headers.set("Set-Cookie", await destroySession(request));
  return response;
}
