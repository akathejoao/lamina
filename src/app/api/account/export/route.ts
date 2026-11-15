import { decryptJson } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { isLedger } from "@/lib/fresh";
import { jsonError } from "@/lib/guard";
import { readSession } from "@/lib/session";

export async function GET() {
  const session = await readSession();
  if (!session) return jsonError(401, "Entre para exportar.");
  const rows = await sql<{ ciphertext: string }>(`select ciphertext from ledgers where user_id = $1`, [session.userId]);
  const row = rows[0];
  if (!row) return jsonError(404, "Planilha não encontrada.");
  const ledger = decryptJson(session.dek, row.ciphertext);
  if (!isLedger(ledger)) return jsonError(500, "A planilha salva está incompleta.");
  return new Response(JSON.stringify(ledger, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": "attachment; filename=\"lamina-meus-dados.json\"",
    },
  });
}
