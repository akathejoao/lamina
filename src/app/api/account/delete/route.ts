import { verifyPassword } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { asRecord, jsonError, readJson } from "@/lib/guard";
import { clearSessionCookie, readSession, sameOrigin } from "@/lib/session";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Origem não aceita.");
  const session = await readSession();
  if (!session) return jsonError(401, "Entre para apagar a conta.");
  const body = asRecord(await readJson(request));
  const password = typeof body?.password === "string" ? body.password : "";
  const rows = await sql<{ password_salt: string; password_hash: string }>(
    `select password_salt, password_hash from users where id = $1`,
    [session.userId],
  );
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_salt, user.password_hash))) {
    return jsonError(401, "A senha não confere.");
  }
  await sql(`delete from users where id = $1`, [session.userId]);
  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", clearSessionCookie(request));
  return response;
}
