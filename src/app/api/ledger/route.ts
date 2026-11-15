import { decryptJson, encryptJson } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { isLedger } from "@/lib/fresh";
import { jsonError, readJson } from "@/lib/guard";
import { readSession, sameOrigin } from "@/lib/session";
import type { LedgerState } from "@/lib/types";

type LedgerRow = { ciphertext: string };
type AccountRow = { email: string; consent_at: string; terms_version: string; role: string; access_status: string };

export async function GET() {
  const session = await readSession();
  if (!session) return jsonError(401, "Entre para abrir a planilha.");
  const ledgers = await sql<LedgerRow>(`select ciphertext from ledgers where user_id = $1`, [session.userId]);
  const accounts = await sql<AccountRow>(
    `select email, consent_at, terms_version, role, access_status from users where id = $1`,
    [session.userId],
  );
  const row = ledgers[0];
  const account = accounts[0];
  if (!row || !account) return jsonError(404, "Conta não encontrada.");
  let ledger: LedgerState;
  try {
    ledger = decryptJson<LedgerState>(session.dek, row.ciphertext);
  } catch {
    return jsonError(500, "Não foi possível abrir a planilha cifrada.");
  }
  if (!isLedger(ledger)) return jsonError(500, "A planilha salva está incompleta.");
  return Response.json({
    ledger,
    account: {
      email: account.email,
      consentAt: account.consent_at,
      termsVersion: account.terms_version,
      role: account.role === "admin" ? "admin" : "user",
      access: account.access_status === "ativo" || account.access_status === "bloqueado" ? account.access_status : "cortesia",
    },
  });
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Origem não aceita.");
  const session = await readSession();
  if (!session) return jsonError(401, "Entre para salvar.");
  const body = await readJson(request);
  if (!isLedger(body)) return jsonError(400, "Planilha inválida.");
  const encoded = JSON.stringify(body);
  if (encoded.length > 1_500_000) return jsonError(413, "A planilha passou do tamanho que a conta guarda.");
  const ciphertext = encryptJson(session.dek, body);
  await sql(`update ledgers set ciphertext = $1, updated_at = now() where user_id = $2`, [ciphertext, session.userId]);
  return Response.json({ ok: true });
}
