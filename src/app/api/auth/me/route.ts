import { loadAccount } from "@/lib/access";
import { sql } from "@/lib/db";
import { jsonBody } from "@/lib/guard";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readSession();
  if (!session) return jsonBody({ account: null });
  const account = await loadAccount(session.userId);
  if (!account) return jsonBody({ account: null });
  const rows = await sql<{ name: string; consent_at: string; terms_version: string }>(
    `select name, consent_at, terms_version from users where id = $1`,
    [session.userId],
  );
  const user = rows[0];
  if (!user) return jsonBody({ account: null });
  return jsonBody({
    account: {
      email: account.email,
      name: user.name,
      consentAt: user.consent_at,
      termsVersion: user.terms_version,
      role: account.role,
      access: account.access,
    },
  });
}
