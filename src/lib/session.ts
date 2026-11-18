import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "./db";
import { sessionSecretIsConfigured } from "./secret";
import { openSessionToken, sealSessionToken } from "./session-token";

const COOKIE = "lamina_session";
const MAX_AGE = 60 * 60 * 24 * 14;

function persistsSessionRow(): boolean {
  return (process.env.DATABASE_URL?.trim() ?? "") !== "" && sessionSecretIsConfigured();
}

export async function createSession(userId: string, dek: Buffer, request: Request): Promise<string> {
  const sid = randomBytes(32).toString("base64url");
  const exp = Date.now() + MAX_AGE * 1000;
  const token = sealSessionToken({ sub: userId, sid, exp, dek });
  if (persistsSessionRow()) {
    await sql(`delete from sessions where expires_at < now()`);
    await sql(`insert into sessions (id, user_id, expires_at) values ($1, $2, to_timestamp($3))`, [
      sid,
      userId,
      exp / 1000,
    ]);
  }
  return cookieHeader(`${COOKIE}=${token}`, MAX_AGE, request);
}

export async function readSession(): Promise<{ userId: string; dek: Buffer } | null> {
  const jar = await cookies();
  const opened = openSessionToken(jar.get(COOKIE)?.value);
  if (!opened) return null;
  if (!persistsSessionRow()) return { userId: opened.userId, dek: opened.dek };
  const rows = await sql<{ user_id: string }>(
    `select user_id from sessions where id = $1 and expires_at > now()`,
    [opened.sid],
  );
  const row = rows[0];
  if (!row || row.user_id !== opened.userId) return null;
  return { userId: row.user_id, dek: opened.dek };
}

export async function destroySession(request: Request): Promise<string> {
  const jar = await cookies();
  const opened = openSessionToken(jar.get(COOKIE)?.value);
  if (opened && persistsSessionRow()) {
    await sql(`delete from sessions where id = $1`, [opened.sid]);
  }
  return clearSessionCookie(request);
}

export async function revokeUserSessions(userId: string): Promise<void> {
  if ((process.env.DATABASE_URL?.trim() ?? "") === "") return;
  await sql(`delete from sessions where user_id = $1`, [userId]);
}

export function clearSessionCookie(request: Request): string {
  return cookieHeader(`${COOKIE}=`, 0, request);
}

function cookieHeader(pair: string, maxAge: number, request: Request): string {
  const parts = [pair, "HttpOnly", "SameSite=Lax", "Path=/", `Max-Age=${maxAge}`];
  if (isSecure(request)) parts.push("Secure");
  return parts.join("; ");
}

function isSecure(request: Request): boolean {
  if (new URL(request.url).protocol === "https:") return true;
  const forwarded = request.headers.get("x-forwarded-proto") ?? "";
  return forwarded.split(",").some((part) => part.trim() === "https");
}

export function sameOrigin(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const url = new URL(origin);
      if (url.host === host) return true;
      const local = new Set(["localhost", "127.0.0.1"]);
      return local.has(url.hostname) && local.has(host.split(":")[0] ?? "");
    } catch {
      return false;
    }
  }
  const site = request.headers.get("sec-fetch-site");
  return site === "same-origin" || site === "none";
}
