import { isDesignatedAdmin, syncAdminRole } from "@/lib/admin";
import {
  burnPasswordCheck,
  hashPassword,
  passwordHashIsLegacy,
  unwrapDek,
  verifyPassword,
  wrapDek,
  wrappedDekIsLegacy,
} from "@/lib/crypto";
import { sql } from "@/lib/db";
import { asRecord, blockedError, cleanEmail, cleanPassword, clientIp, jsonBody, jsonError, limited, readJson } from "@/lib/guard";
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

const WINDOW = 15 * 60 * 1000;
const TOO_MANY = "Muitas tentativas. Espere quinze minutos.";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Origem não aceita.");
  const ip = clientIp(request);
  if (ip && (await limited(`login-ip:${ip}`, 60, WINDOW))) return jsonError(429, TOO_MANY);
  const body = asRecord(await readJson(request));
  const email = cleanEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !cleanPassword(password)) {
    return jsonError(401, "E-mail ou senha não conferem.");
  }
  if (await limited(`login:${email}`, 15, WINDOW)) return jsonError(429, TOO_MANY);
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
  await upgradeCredentials(user, password, dek);
  await syncAdminRole(email);
  const response = jsonBody({ ok: true });
  response.headers.set("Set-Cookie", await createSession(user.id, dek, request));
  return response;
}

// Conta criada com o scrypt antigo: na primeira entrada certa, refaz o hash e o invólucro da
// chave com o custo novo. Se outra aba trocou a senha no meio, a condição no update não casa
// e nada muda. Uma falha aqui não impede o login.
async function upgradeCredentials(user: UserRow, password: string, dek: Buffer): Promise<void> {
  if (!passwordHashIsLegacy(user.password_hash) && !wrappedDekIsLegacy(user.wrapped_dek)) return;
  try {
    const passwordRecord = await hashPassword(password);
    const wrapped = await wrapDek(password, dek);
    await sql(
      `update users set password_salt = $1, password_hash = $2, wrap_salt = $3, wrapped_dek = $4
       where id = $5 and password_hash = $6 and wrapped_dek = $7`,
      [passwordRecord.salt, passwordRecord.hash, wrapped.salt, wrapped.wrapped, user.id, user.password_hash, user.wrapped_dek],
    );
  } catch {
    console.error("credential upgrade failed");
  }
}
