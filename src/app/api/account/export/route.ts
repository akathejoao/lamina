import { presentAccess } from "@/lib/access";
import { burnPasswordCheck, decryptJson, unwrapDek, verifyPassword } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { isLedger, scrubLedger } from "@/lib/fresh";
import { asRecord, cleanEmail, clientIp, jsonError, limited, readJson } from "@/lib/guard";
import { readSession, sameOrigin } from "@/lib/session";
import type { LedgerState } from "@/lib/types";

type ExportRow = {
  id: string;
  name: string;
  email: string;
  access_status: string;
  admin_note: string;
  created_at: string | Date;
  consent_at: string | Date;
  terms_version: string;
  privacy_version: string;
  password_salt: string;
  password_hash: string;
  wrap_salt: string;
  wrapped_dek: string;
  ciphertext: string | null;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW = 15 * 60 * 1000;
const TOO_MANY = "Muitas tentativas. Espere quinze minutos.";

// Exportar os próprios dados vale também para conta bloqueada. Com sessão, o GET basta.
// Sem sessão (o bloqueio derruba as sessões), o POST pede e-mail e senha, como apagar a conta.
export async function GET() {
  const session = await readSession();
  if (!session) return jsonError(401, "Entre para exportar.");
  const rows = await sql<ExportRow>(
    `select u.id, u.name, u.email, u.access_status, u.admin_note, u.created_at, u.consent_at, u.terms_version, u.privacy_version,
     u.password_salt, u.password_hash, u.wrap_salt, u.wrapped_dek, l.ciphertext
     from users u left join ledgers l on l.user_id = u.id where u.id = $1`,
    [session.userId],
  );
  const row = rows[0];
  if (!row) return jsonError(401, "Entre de novo.");
  return exportFile(row, session.dek);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Origem não aceita.");
  const ip = clientIp(request);
  if (ip && (await limited(`export-ip:${ip}`, 30, WINDOW))) return jsonError(429, TOO_MANY);
  const body = asRecord(await readJson(request));
  const email = cleanEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || password === "" || password.length > 200) return jsonError(401, "Informe o e-mail e a senha da conta.");
  if (await limited(`export:${email}`, 8, WINDOW)) return jsonError(429, TOO_MANY);
  const rows = await sql<ExportRow>(
    `select u.id, u.name, u.email, u.access_status, u.admin_note, u.created_at, u.consent_at, u.terms_version, u.privacy_version,
     u.password_salt, u.password_hash, u.wrap_salt, u.wrapped_dek, l.ciphertext
     from users u left join ledgers l on l.user_id = u.id where u.email = $1`,
    [email],
  );
  const row = rows[0];
  if (!row) {
    await burnPasswordCheck(password);
    return jsonError(401, "E-mail ou senha não conferem.");
  }
  const passwordOk = await verifyPassword(password, row.password_salt, row.password_hash).catch(() => false);
  if (!passwordOk) return jsonError(401, "E-mail ou senha não conferem.");
  const dek = await unwrapDek(password, row.wrap_salt, row.wrapped_dek);
  if (!dek) return jsonError(401, "E-mail ou senha não conferem.");
  return exportFile(row, dek);
}

function exportFile(row: ExportRow, dek: Buffer): Response {
  if (!row.ciphertext) return jsonError(404, "Planilha não encontrada.");
  let ledger: LedgerState;
  try {
    ledger = decryptJson<LedgerState>(dek, row.ciphertext);
  } catch {
    return jsonError(500, "Não foi possível abrir a planilha cifrada.");
  }
  if (!isLedger(ledger)) return jsonError(500, "A planilha salva está incompleta.");
  const data = {
    account: {
      name: row.name,
      email: row.email,
      createdAt: row.created_at,
      consentAt: row.consent_at,
      termsVersion: row.terms_version,
      privacyVersion: row.privacy_version,
      access: presentAccess(row.email, row.access_status),
      adminNote: row.admin_note,
    },
    ledger: scrubLedger(ledger),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="lamina-meus-dados.json"',
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
