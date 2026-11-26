import { createCipheriv, createDecipheriv, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

export const TERMS_VERSION = "2026-11-15";
export const PRIVACY_VERSION = "2026-11-15";

// Formato antigo: scrypt com os padrões do Node (N=2**14), sem prefixo.
// Formato "v2:": N=2**17, r=8, p=1, uns 128 MB de memória por derivação.
const VERSION_PREFIX = "v2:";
const CURRENT: ScryptOptions = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const LEGACY: ScryptOptions = {};

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

function split(value: string): { options: ScryptOptions; body: string } {
  return value.startsWith(VERSION_PREFIX)
    ? { options: CURRENT, body: value.slice(VERSION_PREFIX.length) }
    : { options: LEGACY, body: value };
}

export async function hashPassword(password: string, salt = randomBytes(16)): Promise<{ salt: string; hash: string }> {
  const derived = await derive(password, salt, CURRENT);
  return { salt: salt.toString("base64url"), hash: `${VERSION_PREFIX}${derived.toString("base64url")}` };
}

export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const { options, body } = split(hash);
  const derived = await derive(password, Buffer.from(salt, "base64url"), options);
  const expected = Buffer.from(body, "base64url");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function passwordHashIsLegacy(hash: string): boolean {
  return !hash.startsWith(VERSION_PREFIX);
}

export function wrappedDekIsLegacy(wrapped: string): boolean {
  return !wrapped.startsWith(VERSION_PREFIX);
}

export function newDek(): Buffer {
  return randomBytes(32);
}

export async function wrapDek(password: string, dek: Buffer, salt = randomBytes(16)): Promise<{ salt: string; wrapped: string }> {
  const key = await derive(password, salt, CURRENT);
  return { salt: salt.toString("base64url"), wrapped: `${VERSION_PREFIX}${seal(key, dek)}` };
}

export async function unwrapDek(password: string, salt: string, wrapped: string): Promise<Buffer | null> {
  try {
    const { options, body } = split(wrapped);
    const key = await derive(password, Buffer.from(salt, "base64url"), options);
    return open(key, body);
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

export function sealBytes(key: Buffer, plain: Buffer): string {
  return seal(key, plain);
}

export function openBytes(key: Buffer, sealed: string): Buffer {
  return open(key, sealed);
}

export async function burnPasswordCheck(password: string): Promise<void> {
  dummyRecord ??= await hashPassword("lamina-dummy-password-not-a-login");
  await verifyPassword(password, dummyRecord.salt, dummyRecord.hash);
}

let dummyRecord: { salt: string; hash: string } | null = null;

const TAG_BYTES = 16;
const IV_BYTES = 12;

function seal(key: Buffer, plain: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

function open(key: Buffer, sealed: string): Buffer {
  const [iv, tag, ciphertext] = sealed.split(".");
  if (!iv || !tag || !ciphertext) throw new Error("sealed payload is incomplete");
  const ivBytes = Buffer.from(iv, "base64url");
  const tagBytes = Buffer.from(tag, "base64url");
  if (ivBytes.length !== IV_BYTES || tagBytes.length !== TAG_BYTES) throw new Error("sealed payload is malformed");
  const decipher = createDecipheriv("aes-256-gcm", key, ivBytes, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tagBytes);
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]);
}
