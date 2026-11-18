const hits = new Map<string, number[]>();
const MAX_KEYS = 4000;

export function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (!hits.has(key) && hits.size >= MAX_KEYS) {
    const oldest = hits.keys().next().value;
    if (oldest) hits.delete(oldest);
  }
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
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

export async function readJson(request: Request, maxBytes = 32_768): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return null;
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
        return null;
      }
      chunks.push(value);
    }
    if (total === 0) return null;
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    return null;
  }
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
