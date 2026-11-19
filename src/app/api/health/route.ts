import { hasDatabase } from "@/lib/db";
import { sessionSecretIsConfigured } from "@/lib/secret";
import { jsonBody } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const database = hasDatabase();
  const session = sessionSecretIsConfigured();
  const ready = database && session;
  return jsonBody(
    {
      ok: ready,
      database,
      sessionSecret: session,
      admin: Boolean(process.env.ADMIN_EMAIL?.trim()),
      adminSetup: (process.env.ADMIN_SETUP_TOKEN?.trim().length ?? 0) >= 16,
    },
    ready ? 200 : 503,
  );
}
