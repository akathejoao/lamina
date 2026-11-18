import { ensureDesignatedAdmin, isDesignatedAdmin } from "./admin";
import { sql } from "./db";
import { blockedError, jsonError } from "./guard";

export type Access = "cortesia" | "ativo" | "bloqueado";

export type AccountGate = {
  email: string;
  role: "admin" | "user";
  access: Access;
};

export function presentAccess(email: string, status: string): Access {
  if (isDesignatedAdmin(email) && status === "bloqueado") return "ativo";
  if (status === "ativo" || status === "bloqueado") return status;
  return "cortesia";
}

export async function loadAccount(userId: string): Promise<AccountGate | null> {
  const rows = await sql<{ email: string; role: string; access_status: string }>(
    `select email, role, access_status from users where id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  if (isDesignatedAdmin(row.email) && row.role !== "admin") await ensureDesignatedAdmin(row.email);
  return {
    email: row.email,
    role: isDesignatedAdmin(row.email) || row.role === "admin" ? "admin" : "user",
    access: presentAccess(row.email, row.access_status),
  };
}

export async function requireActive(userId: string): Promise<AccountGate | Response> {
  const account = await loadAccount(userId);
  if (!account) return jsonError(401, "Entre de novo.");
  if (account.access === "bloqueado") return blockedError();
  return account;
}
