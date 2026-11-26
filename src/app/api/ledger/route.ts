import { requireActive } from "@/lib/access";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { isLedger, scrubLedger } from "@/lib/fresh";
import { asRecord, jsonBody, jsonError, readJsonResult } from "@/lib/guard";
import { readSession, sameOrigin } from "@/lib/session";
import type { LedgerState } from "@/lib/types";
import { validateLedger } from "@/lib/validate";

type LedgerRow = { ciphertext: string; version: number };
type ConsentRow = { consent_at: string; terms_version: string };

const MAX_VERSION = 2_000_000_000;
const TOO_LARGE = "A planilha passou do tamanho que a conta guarda.";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readSession();
  if (!session) return jsonError(401, "Entre para abrir a planilha.");
  const gate = await requireActive(session.userId);
  if (gate instanceof Response) return gate;
  const ledgers = await sql<LedgerRow>(`select ciphertext, version from ledgers where user_id = $1`, [session.userId]);
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
    version: Number(row.version),
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
  // O corpo leva a versão que o aparelho abriu. Se outra aba ou aparelho salvou antes,
  // a versão mudou e a gravação é recusada com 409, em vez de apagar o trabalho do outro.
  const read = await readJsonResult(request, 1_600_000);
  if (!read.ok) {
    if (read.reason === "too_large") return jsonError(413, TOO_LARGE);
    return jsonError(400, "Pedido inválido. Recarregue a página e tente de novo.");
  }
  const body = asRecord(read.value);
  if (!body) return jsonError(400, "Pedido inválido. Recarregue a página e tente de novo.");
  const version = body.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0 || version > MAX_VERSION) {
    return jsonError(400, "Falta a versão da planilha. Recarregue a página.");
  }
  if (!isLedger(body.ledger)) return jsonError(400, "Planilha inválida.");
  const checked = validateLedger(body.ledger);
  if (!checked.ok) return jsonError(400, checked.message);
  const clean = scrubLedger(checked.ledger);
  const encoded = JSON.stringify(clean);
  if (encoded.length > 1_500_000) return jsonError(413, TOO_LARGE);
  const ciphertext = encryptJson(session.dek, clean);
  const saved = await sql<{ version: number }>(
    `update ledgers set ciphertext = $1, updated_at = now(), version = version + 1 where user_id = $2 and version = $3 returning version`,
    [ciphertext, session.userId, version],
  );
  const row = saved[0];
  if (!row) return jsonError(409, "A planilha mudou em outro aparelho.", { conflict: true });
  return jsonBody({ ok: true, version: Number(row.version) });
}
