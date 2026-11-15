import { createCipheriv, createDecipheriv, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export const TERMS_VERSION = "2026-11-15";
export const PRIVACY_VERSION = "2026-11-15";

export async function hashPassword(password: string, salt = randomBytes(16)): Promise<{ salt: string; hash: string }> {
  const derived = (await scryptAsync(password, salt, 32)) as Buffer;
  return { salt: salt.toString("base64url"), hash: derived.toString("base64url") };
}

export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const derived = (await scryptAsync(password, Buffer.from(salt, "base64url"), 32)) as Buffer;
  const expected = Buffer.from(hash, "base64url");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function newDek(): Buffer {
  return randomBytes(32);
}

export async function wrapDek(password: string, dek: Buffer, salt = randomBytes(16)): Promise<{ salt: string; wrapped: string }> {
  const key = (await scryptAsync(password, salt, 32)) as Buffer;
  return { salt: salt.toString("base64url"), wrapped: seal(key, dek) };
}

export async function unwrapDek(password: string, salt: string, wrapped: string): Promise<Buffer | null> {
  try {
    const key = (await scryptAsync(password, Buffer.from(salt, "base64url"), 32)) as Buffer;
    return open(key, wrapped);
  } catch {
    return null;
  }
}

export function encryptJson(dek: Buffer, value: unknown): string {
  return seal(dek, Buffer.from(JSON.stringify(value), "utf8"));
}

export function decryptJson<T>(dek: Buffer, sealed: string): T {
  return JSON.parse(open(dek, sealed).toString("utf8")) as T;
}

function seal(key: Buffer, plain: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

function open(key: Buffer, sealed: string): Buffer {
  const [iv, tag, ciphertext] = sealed.split(".");
  if (!iv || !tag || !ciphertext) throw new Error("sealed payload is incomplete");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]);
}
