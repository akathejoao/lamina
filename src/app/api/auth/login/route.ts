import { ensureDesignatedAdmin, isDesignatedAdmin } from "@/lib/admin";
import { burnPasswordCheck, unwrapDek, verifyPassword } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { asRecord, blockedError, cleanEmail, cleanPassword, jsonBody, jsonError, limited, readJson } from "@/lib/guard";
import { createSession, sameOrigin } from "@/lib/session";

type UserRow = {
  id: string;
  password_salt: string;
  password_hash: string;
  wrap_salt: string;
  wrapped_dek: string;
  access_status: string;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Origem não aceita.");
  if (limited("login:*", 300, 15 * 60 * 1000)) {
    return jsonError(429, "Muitas tentativas. Espere quinze minutos.");
  }
  const body = asRecord(await readJson(request));
  const email = cleanEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !cleanPassword(password)) {
    return jsonError(401, "E-mail ou senha não conferem.");
  }
  if (limited(`login:${email}`, 15, 15 * 60 * 1000)) {
    return jsonError(429, "Muitas tentativas. Espere quinze minutos.");
  }
  const rows = await sql<UserRow>(
    `select id, password_salt, password_hash, wrap_salt, wrapped_dek, access_status from users where email = $1`,
    [email],
  );
  const user = rows[0];
  if (!user) {
    await burnPasswordCheck(password);
    return jsonError(401, "E-mail ou senha não conferem.");
  }
  const passwordOk = await verifyPassword(password, user.password_salt, user.password_hash).catch(() => false);
  if (!passwordOk) return jsonError(401, "E-mail ou senha não conferem.");
  if (user.access_status === "bloqueado" && !isDesignatedAdmin(email)) return blockedError();
  const dek = await unwrapDek(password, user.wrap_salt, user.wrapped_dek);
  if (!dek) return jsonError(401, "E-mail ou senha não conferem.");
  await ensureDesignatedAdmin(email);
  const response = jsonBody({ ok: true });
  response.headers.set("Set-Cookie", await createSession(user.id, dek, request));
  return response;
}
