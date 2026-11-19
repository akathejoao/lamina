import { burnPasswordCheck, verifyPassword } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { asRecord, cleanEmail, jsonBody, jsonError, limited, readJson } from "@/lib/guard";
import { destroySession, readSession, sameOrigin } from "@/lib/session";

type Row = { id: string; password_salt: string; password_hash: string };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Apagar a conta vale até para conta bloqueada. Com sessão, basta a senha.
// Sem sessão (o bloqueio derruba as sessões e o login recusa), vale e-mail e senha.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Origem não aceita.");
  const session = await readSession();
  const body = asRecord(await readJson(request));
  const password = typeof body?.password === "string" ? body.password : "";
  const email = session ? null : cleanEmail(body?.email);
  if (!session && !email) return jsonError(401, "Informe o e-mail e a senha da conta.");
  const key = session ? `delete:${session.userId}` : `delete:${email}`;
  if (limited(key, 8, 15 * 60 * 1000)) {
    return jsonError(429, "Muitas tentativas. Espere quinze minutos.");
  }
  const rows = session
    ? await sql<Row>(`select id, password_salt, password_hash from users where id = $1`, [session.userId])
    : await sql<Row>(`select id, password_salt, password_hash from users where email = $1`, [email]);
  const user = rows[0];
  if (!user) {
    await burnPasswordCheck(password);
    return jsonError(401, session ? "A senha não confere." : "E-mail ou senha não conferem.");
  }
  const passwordOk = await verifyPassword(password, user.password_salt, user.password_hash).catch(() => false);
  if (!passwordOk) return jsonError(401, session ? "A senha não confere." : "E-mail ou senha não conferem.");
  await sql(`delete from users where id = $1`, [user.id]);
  const response = jsonBody({ ok: true });
  response.headers.set("Set-Cookie", await destroySession(request));
  return response;
}
