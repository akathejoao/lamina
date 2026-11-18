import { jsonBody, jsonError } from "@/lib/guard";
import { destroySession, sameOrigin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Origem não aceita.");
  const response = jsonBody({ ok: true });
  response.headers.set("Set-Cookie", await destroySession(request));
  return response;
}
