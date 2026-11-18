import { requireActive } from "@/lib/access";
import { decryptJson } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { isLedger, scrubLedger } from "@/lib/fresh";
import { jsonError } from "@/lib/guard";
import { readSession } from "@/lib/session";
import type { LedgerState } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readSession();
  if (!session) return jsonError(401, "Entre para exportar.");
  const gate = await requireActive(session.userId);
  if (gate instanceof Response) return gate;
  const rows = await sql<{ ciphertext: string }>(`select ciphertext from ledgers where user_id = $1`, [session.userId]);
  const row = rows[0];
  if (!row) return jsonError(404, "Planilha não encontrada.");
  let ledger: LedgerState;
  try {
    ledger = decryptJson<LedgerState>(session.dek, row.ciphertext);
  } catch {
    return jsonError(500, "Não foi possível abrir a planilha cifrada.");
  }
  if (!isLedger(ledger)) return jsonError(500, "A planilha salva está incompleta.");
  ledger = scrubLedger(ledger);
  return new Response(JSON.stringify(ledger, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="lamina-meus-dados.json"',
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
