import { loadAccount } from "@/lib/access";
import { hasDatabase } from "@/lib/db";
import { jsonBody } from "@/lib/guard";
import { sessionSecretIsConfigured } from "@/lib/secret";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Público: só se o serviço está de pé e se há banco. Os detalhes de configuração
// (segredo da sessão, admin) só aparecem para uma sessão de administrador válida.
export async function GET() {
  const database = hasDatabase();
  const session = sessionSecretIsConfigured();
  const ready = database && session;
  const status = ready ? 200 : 503;
  const admin = await adminSession();
  if (!admin) return jsonBody({ ok: ready, database }, status);
  return jsonBody(
    {
      ok: ready,
      database,
      sessionSecret: session,
      admin: Boolean(process.env.ADMIN_EMAIL?.trim()),
      adminSetup: (process.env.ADMIN_SETUP_TOKEN?.trim().length ?? 0) >= 16,
    },
    status,
  );
}

async function adminSession(): Promise<boolean> {
  try {
    const session = await readSession();
    if (!session) return false;
    const account = await loadAccount(session.userId);
    return account?.role === "admin" && account.access !== "bloqueado";
  } catch {
    return false;
  }
}
