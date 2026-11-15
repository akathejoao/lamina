import { clearSessionCookie, sameOrigin } from "@/lib/session";
import { jsonError } from "@/lib/guard";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Origem não aceita.");
  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", clearSessionCookie(request));
  return response;
}
