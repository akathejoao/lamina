import { createHmac, timingSafeEqual } from "node:crypto";
import { openBytes, sealBytes } from "./crypto";
import { boxKey, macKey } from "./secret";

type Payload = {
  sub: string;
  sid: string;
  exp: number;
  box: string;
};

export function sealSessionToken(input: { sub: string; sid: string; exp: number; dek: Buffer }): string {
  const payload: Payload = {
    sub: input.sub,
    sid: input.sid,
    exp: input.exp,
    box: sealBytes(boxKey(), input.dek),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const mac = createHmac("sha256", macKey()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function openSessionToken(token: string | undefined): { userId: string; sid: string; dek: Buffer } | null {
  if (!token || token.length > 4096) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!body || !mac || mac.includes(".")) return null;
  const expected = createHmac("sha256", macKey()).update(body).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  let payload: Partial<Payload>;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<Payload>;
  } catch {
    return null;
  }
  if (typeof payload.sub !== "string" || payload.sub.length < 1 || payload.sub.length > 80) return null;
  if (typeof payload.sid !== "string" || payload.sid.length < 16 || payload.sid.length > 80) return null;
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp < Date.now()) return null;
  if (typeof payload.box !== "string" || payload.box.length < 16 || payload.box.length > 400) return null;
  try {
    const dek = openBytes(boxKey(), payload.box);
    if (dek.length !== 32) return null;
    return { userId: payload.sub, sid: payload.sid, dek };
  } catch {
    return null;
  }
}
