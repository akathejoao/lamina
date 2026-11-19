import { createHash, randomBytes } from "node:crypto";
import { chmodSync, closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";

const MIN = 32;

export function sessionSecretIsConfigured(): boolean {
  return (process.env.SESSION_SECRET?.trim() ?? "").length >= MIN;
}

export function sessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim() ?? "";
  if (configured.length >= MIN) return configured;
  if (isHosted()) {
    throw new Error("SESSION_SECRET com pelo menos 32 caracteres é obrigatório na hospedagem.");
  }
  if ((process.env.DATABASE_URL?.trim() ?? "") !== "") return ephemeral();
  return localFile();
}

function isHosted(): boolean {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

let memorySecret: string | undefined;

function ephemeral(): string {
  memorySecret ??= randomBytes(32).toString("base64url");
  return memorySecret;
}

function localFile(): string {
  if (memorySecret) return memorySecret;
  const path = ".data/session-secret";
  try {
    mkdirSync(".data", { recursive: true, mode: 0o700 });
  } catch {
    /* the directory already exists */
  }
  try {
    const existing = readFileSync(path, "utf8").trim();
    if (existing.length >= MIN) {
      try {
        chmodSync(path, 0o600);
      } catch {
        /* local permissions stay as they are */
      }
      memorySecret = existing;
      return memorySecret;
    }
  } catch {
    /* the file is created below */
  }
  const created = randomBytes(32).toString("base64url");
  try {
    const fd = openSync(path, "wx", 0o600);
    writeFileSync(fd, created);
    closeSync(fd);
    memorySecret = created;
    return memorySecret;
  } catch {
    try {
      const existing = readFileSync(path, "utf8").trim();
      memorySecret = existing.length >= MIN ? existing : created;
    } catch {
      memorySecret = created;
    }
    return memorySecret;
  }
}

export function macKey(): Buffer {
  return createHash("sha256").update(`lamina-mac:${sessionSecret()}`).digest();
}

export function boxKey(): Buffer {
  return createHash("sha256").update(`lamina-box:${sessionSecret()}`).digest();
}
