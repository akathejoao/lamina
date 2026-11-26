import { timingSafeEqual } from "node:crypto";
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

function isHosted(): boolean {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

// O e-mail de ADMIN_EMAIL não tem verificação por e-mail. Para ninguém registrar esse
// endereço antes do dono, o cadastro dele exige ADMIN_SETUP_TOKEN. Sem o token na
// hospedagem, o e-mail fica reservado e o cadastro é recusado.
export function adminSetupAccepted(code: unknown): boolean {
  const expected = process.env.ADMIN_SETUP_TOKEN?.trim() ?? "";
  if (expected.length < 16) return !isHosted();
  if (typeof code !== "string") return false;
  const left = Buffer.from(code.trim());
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

// O papel vem só de ADMIN_EMAIL. A coluna role acompanha, para quem consulta o banco.
export async function syncAdminRole(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const role = isDesignatedAdmin(normalized) ? "admin" : "user";
  await sql(`update users set role = $1 where email = $2 and role <> $1`, [role, normalized]);
}

// Só diz que existe um código de administração a quem já mandou o campo do código
// (ou ao desenvolvimento local). Sondagem sem o campo recebe a recusa genérica.
export function mayRevealAdminCode(body: Record<string, unknown> | null): boolean {
  if (!isHosted()) return true;
  const sent = body?.adminCode;
  return typeof sent === "string" && sent.trim() !== "";
}
