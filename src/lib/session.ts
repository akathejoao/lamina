import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "lamina_session";
const MAX_AGE = 60 * 60 * 24 * 14;

type Payload = {
  sub: string;
  exp: number;
  dek: string;
};

let memorySecret: string | undefined;

function secret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;
  memorySecret ??= randomBytes(32).toString("base64url");
  return memorySecret;
}

export function sealSession(userId: string, dek: Buffer): string {
  const payload: Payload = {
    sub: userId,
    exp: Date.now() + MAX_AGE * 1000,
    dek: dek.toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function openSession(token: string | undefined): { userId: string; dek: Buffer } | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
  } catch {
    return null;
  }
  if (!payload.sub || !payload.dek || payload.exp < Date.now()) return null;
  return { userId: payload.sub, dek: Buffer.from(payload.dek, "base64url") };
}

export async function readSession(): Promise<{ userId: string; dek: Buffer } | null> {
  const jar = await cookies();
  return openSession(jar.get(COOKIE)?.value);
}

export function sessionCookie(token: string, request: Request): string {
  return cookieHeader(`${COOKIE}=${token}`, MAX_AGE, request);
}

export function clearSessionCookie(request: Request): string {
  return cookieHeader(`${COOKIE}=`, 0, request);
}

function cookieHeader(pair: string, maxAge: number, request: Request): string {
  const secure = isSecure(request);
  const parts = [pair, "HttpOnly", "SameSite=Lax", "Path=/", `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function isSecure(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwarded) return forwarded === "https";
  return new URL(request.url).protocol === "https:";
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  if (!host) return false;
  try {
    const originHost = new URL(origin).host;
    if (originHost === host) return true;
    const local = new Set(["localhost", "127.0.0.1"]);
    return local.has(new URL(origin).hostname) && local.has(host.split(":")[0] ?? "");
  } catch {
    return false;
  }
}

export function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
