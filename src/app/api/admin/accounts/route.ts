import { sql } from "@/lib/db";
import { asRecord, jsonError, readJson } from "@/lib/guard";
import { readSession, sameOrigin } from "@/lib/session";
import { isDesignatedAdmin } from "@/lib/admin";

const ACCESS = new Set(["cortesia", "ativo", "bloqueado"]);

type Row = {
  name: string;
  email: string;
  role: string;
  access_status: string;
  admin_note: string;
  created_at: string;
  consent_at: string;
  terms_version: string;
  ledger_updated_at: string | null;
};

async function requireAdmin(): Promise<{ userId: string } | Response> {
  const session = await readSession();
  if (!session) return jsonError(401, "Entre para ver as contas.");
  const caller = await sql<{ role: string }>(`select role from users where id = $1`, [session.userId]);
  if (!caller[0]) return jsonError(401, "Entre para ver as contas.");
  if (caller[0].role !== "admin") return jsonError(403, "Só o administrador vê esta lista.");
  return { userId: session.userId };
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;
  const rows = await sql<Row>(
    `select u.name, u.email, u.role, u.access_status, u.admin_note, u.created_at, u.consent_at, u.terms_version, l.updated_at as ledger_updated_at
     from users u
     left join ledgers l on l.user_id = u.id
     order by u.created_at asc`,
  );
  return Response.json({
    accounts: rows.map(present),
  });
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Origem não aceita.");
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;
  const body = asRecord(await readJson(request));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const access = typeof body?.access === "string" ? body.access : "";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 280) : "";
  if (!email || !ACCESS.has(access)) return jsonError(400, "Informe a conta e um acesso válido.");
  if (isDesignatedAdmin(email) && access === "bloqueado") {
    return jsonError(400, "A conta administradora não pode ser bloqueada.");
  }
  const updated = await sql<{ email: string }>(
    `update users set access_status = $1, admin_note = $2 where email = $3 returning email`,
    [access, note, email],
  );
  if (!updated[0]) return jsonError(404, "Conta não encontrada.");
  return Response.json({ ok: true });
}

function present(row: Row) {
  return {
    name: row.name,
    email: row.email,
    role: row.role === "admin" ? "admin" : "user",
    access: row.access_status === "ativo" || row.access_status === "bloqueado" ? row.access_status : "cortesia",
    note: row.admin_note,
    createdAt: row.created_at,
    consentAt: row.consent_at,
    termsVersion: row.terms_version,
    ledgerUpdatedAt: row.ledger_updated_at,
  };
}
