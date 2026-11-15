import { sql } from "@/lib/db";
import { readSession } from "@/lib/session";

export async function GET() {
  const session = await readSession();
  if (!session) return Response.json({ account: null });
  const rows = await sql<{ email: string; name: string; consent_at: string; terms_version: string }>(
    `select email, name, consent_at, terms_version from users where id = $1`,
    [session.userId],
  );
  const user = rows[0];
  if (!user) return Response.json({ account: null });
  return Response.json({
    account: {
      email: user.email,
      name: user.name,
      consentAt: user.consent_at,
      termsVersion: user.terms_version,
    },
  });
}
