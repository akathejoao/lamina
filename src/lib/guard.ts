import { createHash } from "node:crypto";
import { sql } from "./db";

// Limite por janela fixa, guardado no Postgres para valer entre instâncias serverless.
// Cada chamada soma 1 no contador da janela atual; passar do máximo recusa até a janela virar.
// Pedido recusado não estende a janela. Se o banco falhar, cai num contador em memória.
const memory = new Map<string, number[]>();
const MEMORY_KEYS = 4000;
const CLEANUP_CHANCE = 0.02;
const KEEP_SECONDS = 24 * 60 * 60;

export async function limited(key: string, max: number, windowMs: number, now = Date.now()): Promise<boolean> {
  try {
    const bucket = Math.floor(now / windowMs);
    // A chave leva e-mail ou IP; no banco fica só o hash, para a tabela não virar uma lista de contatos.
    const stored = createHash("sha256").update(key).digest("base64url");
    const rows = await sql<{ n: number }>(
      `insert into rate_hits (key, bucket, n) values ($1, $2, 1)
       on conflict (key, bucket) do update set n = rate_hits.n + 1, updated_at = now()
       returning n`,
      [stored, bucket],
    );
    if (Math.random() < CLEANUP_CHANCE) {
      await sql(`delete from rate_hits where updated_at < to_timestamp($1)`, [Date.now() / 1000 - KEEP_SECONDS]);
    }
    return Number(rows[0]?.n ?? 1) > max;
  } catch (error) {
    console.error("rate limit store failed", (error as { code?: string }).code ?? "unknown");
    return limitedInMemory(key, max, windowMs, now);
  }
}

export function limitedInMemory(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  if (!memory.has(key) && memory.size >= MEMORY_KEYS) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  const recent = (memory.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= max) {
    memory.set(key, recent);
    return true;
  }
  recent.push(now);
  memory.set(key, recent);
  return false;
}

// A Vercel escreve x-vercel-forwarded-for sozinha. Fora dela só x-real-ip serve de pista,
// e ela vale tanto quanto o proxy que a escreve. Sem endereço, o limite por IP não se aplica.
export function clientIp(request: Request): string | null {
  const raw = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-real-ip") ?? "";
  const first = raw.split(",")[0]?.trim().slice(0, 64) ?? "";
  return first === "" ? null : first;
}

export function jsonBody(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function jsonError(status: number, message: string, extra?: Record<string, unknown>): Response {
  return jsonBody({ error: message, ...extra }, status);
}

export function blockedError(): Response {
  return jsonError(403, "Esta conta está bloqueada.", { blocked: true });
}

export type JsonRead = { ok: true; value: unknown } | { ok: false; reason: "empty" | "invalid" | "too_large" };

export async function readJsonResult(request: Request, maxBytes = 32_768): Promise<JsonRead> {
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, reason: "empty" };
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (total === 0) return { ok: false, reason: "empty" };
  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export async function readJson(request: Request, maxBytes = 32_768): Promise<unknown> {
  const result = await readJsonResult(request, maxBytes);
  return result.ok ? result.value : null;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return null;
  return name;
}

export function cleanPassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length < 10 || value.length > 200) return null;
  return value;
}
