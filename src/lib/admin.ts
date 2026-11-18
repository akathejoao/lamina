import { sql } from "./db";

export function designatedAdminEmail(): string | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  if (!email || email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function isDesignatedAdmin(email: string): boolean {
  const designated = designatedAdminEmail();
  if (!designated) return false;
  return email.trim().toLowerCase() === designated;
}

export async function ensureDesignatedAdmin(email: string): Promise<void> {
  if (!isDesignatedAdmin(email)) return;
  const normalized = email.trim().toLowerCase();
  await sql(`update users set role = $1 where email = $2 and role <> $3`, ["admin", normalized, "admin"]);
}
