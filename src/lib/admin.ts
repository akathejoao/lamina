import { sql } from "./db";

export const ADMIN_EMAIL = "joaopro9678@gmail.com";

export function isDesignatedAdmin(email: string): boolean {
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

export async function ensureDesignatedAdmin(email: string): Promise<void> {
  if (!isDesignatedAdmin(email)) return;
  await sql(`update users set role = 'admin' where email = $1 and role <> 'admin'`, [email.trim().toLowerCase()]);
}
