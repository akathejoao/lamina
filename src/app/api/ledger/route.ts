import { requireActive } from "@/lib/access";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { isLedger, scrubLedger } from "@/lib/fresh";
import { jsonBody, jsonError, readJson } from "@/lib/guard";
import { readSession, sameOrigin } from "@/lib/session";
import type { LedgerState } from "@/lib/types";

type LedgerRow = { ciphertext: string };
type ConsentRow = { consent_at: string; terms_version: string };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readSession();
  if (!session) return jsonError(401, "Entre para abrir a planilha.");
  const gate = await requireActive(session.userId);
  if (gate instanceof Response) return gate;
  const ledgers = await sql<LedgerRow>(`select ciphertext from ledgers where user_id = $1`, [session.userId]);
  const consent = await sql<ConsentRow>(`select consent_at, terms_version from users where id = $1`, [session.userId]);
  const row = ledgers[0];
  const account = consent[0];
  if (!row || !account) return jsonError(404, "Conta não encontrada.");
  let ledger: LedgerState;
  try {
    ledger = decryptJson<LedgerState>(session.dek, row.ciphertext);
  } catch {
    return jsonError(500, "Não foi possível abrir a planilha cifrada.");
  }
  if (!isLedger(ledger)) return jsonError(500, "A planilha salva está incompleta.");
  ledger = scrubLedger(ledger);
  return jsonBody({
    ledger,
    account: {
      email: gate.email,
      consentAt: account.consent_at,
      termsVersion: account.terms_version,
      role: gate.role,
      access: gate.access,
    },
  });
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Origem não aceita.");
  const session = await readSession();
  if (!session) return jsonError(401, "Entre para salvar.");
  const gate = await requireActive(session.userId);
  if (gate instanceof Response) return gate;
  const body = await readJson(request, 1_600_000);
  if (!isLedger(body)) return jsonError(400, "Planilha inválida.");
  const clean = scrubLedger(body);
  const encoded = JSON.stringify(clean);
  if (encoded.length > 1_500_000) return jsonError(413, "A planilha passou do tamanho que a conta guarda.");
  const ciphertext = encryptJson(session.dek, clean);
  await sql(`update ledgers set ciphertext = $1, updated_at = now() where user_id = $2`, [ciphertext, session.userId]);
  return jsonBody({ ok: true });
}
