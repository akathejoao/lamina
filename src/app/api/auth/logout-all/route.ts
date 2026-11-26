import { jsonBody, jsonError } from "@/lib/guard";
import { clearSessionCookie, readSession, revokeUserSessions, sameOrigin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Encerra a sessão em todos os aparelhos, inclusive neste.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Origem não aceita.");
  const session = await readSession();
  if (session) await revokeUserSessions(session.userId);
  const response = jsonBody({ ok: true });
  response.headers.set("Set-Cookie", clearSessionCookie(request));
  return response;
}
