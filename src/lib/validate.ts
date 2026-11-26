import type {
  Banner,
  ChatMessage,
  Entry,
  EntrySource,
  EntryType,
  Goal,
  LedgerState,
  Profile,
  Sheet,
  SheetAccent,
  SheetCategory,
  SheetKind,
  SheetSplit,
  SliceKey,
  Tone,
} from "./types";

// Valida cada item da planilha que o aparelho manda e devolve uma cópia só com os campos
// conhecidos. Nunca lança: formato desconhecido vira { ok: false } com uma mensagem em português.

export type Validated = { ok: true; ledger: LedgerState } | { ok: false; message: string };

export const MAX_ID = 64;
export const MAX_TEXT = 200;
export const MAX_MESSAGE = 2_000;
export const MAX_CENTS = 100_000_000_000;

const ENTRY_TYPES: readonly EntryType[] = ["receita", "fixo", "variavel", "assinatura", "investimento"];
const ENTRY_SOURCES: readonly EntrySource[] = ["agente", "manual", "csv"];
const SHEET_KINDS: readonly SheetKind[] = ["mensal", "meta", "continuo"];
const ACCENTS: readonly SheetAccent[] = ["violeta", "menta", "coral", "ambar"];
const SLICES: readonly SliceKey[] = ["essenciais", "estilo", "futuro"];
const BANNERS: readonly Banner[] = ["violeta", "noite", "papel"];
const TONES: readonly Tone[] = ["direto", "calmo"];
const ROLES: readonly ChatMessage["role"][] = ["user", "agent"];

class Invalid extends Error {}

function fail(where: string): never {
  throw new Invalid(`Algum dado ficou inválido (${where}). Recarregue a página e tente de novo.`);
}

function record(value: unknown, where: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(where);
  return value as Record<string, unknown>;
}

function str(value: unknown, where: string, max = MAX_TEXT): string {
  if (typeof value !== "string" || value.length > max) fail(where);
  return value;
}

function id(value: unknown, where: string): string {
  const text = str(value, where, MAX_ID);
  if (text === "") fail(where);
  return text;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], where: string): T {
  if (typeof value !== "string" || !(options as readonly string[]).includes(value)) fail(where);
  return value as T;
}

function cents(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || Math.abs(value) > MAX_CENTS) fail(where);
  return value;
}

function bool(value: unknown, where: string, fallback?: boolean): boolean {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "boolean") fail(where);
  return value;
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isoDate(value: unknown, where: string): string {
  if (!isIsoDate(value)) fail(where);
  return value;
}

function month(value: unknown, where: string): string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) fail(where);
  return value;
}

function nullable<T>(value: unknown, read: (value: unknown) => T): T | null {
  return value === null || value === undefined ? null : read(value);
}

function list(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) fail(where);
  return value;
}

function entry(raw: unknown, index: number): Entry {
  const where = `lançamento ${index + 1}`;
  const item = record(raw, where);
  const installment = nullable(item.installment, (value) => {
    const part = record(value, where);
    const current = part.current;
    const total = part.total;
    if (typeof current !== "number" || !Number.isInteger(current) || current < 0 || current > 1_000) fail(where);
    if (typeof total !== "number" || !Number.isInteger(total) || total < 0 || total > 1_000) fail(where);
    return { current, total };
  });
  const dueDay = nullable(item.dueDay, (value) => {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 31) fail(where);
    return value;
  });
  const clean: Entry = {
    id: id(item.id, where),
    sheetId: id(item.sheetId, where),
    type: oneOf(item.type, ENTRY_TYPES, where),
    title: str(item.title, where),
    category: str(item.category, where),
    cents: cents(item.cents, where),
    date: isoDate(item.date, where),
    dueDay,
    installment,
  };
  if (item.source !== undefined && item.source !== null) clean.source = oneOf(item.source, ENTRY_SOURCES, where);
  return clean;
}

function split(raw: unknown, where: string): SheetSplit {
  const item = record(raw, where);
  const part = (value: unknown) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) fail(where);
    return value;
  };
  return { essenciais: part(item.essenciais), estilo: part(item.estilo), futuro: part(item.futuro) };
}

function sheet(raw: unknown, index: number): Sheet {
  const where = `planilha ${index + 1}`;
  const item = record(raw, where);
  const clean: Sheet = {
    id: id(item.id, where),
    name: str(item.name, where),
    kind: oneOf(item.kind, SHEET_KINDS, where),
    month: nullable(item.month, (value) => month(value, where)),
    deadline: nullable(item.deadline, (value) => isoDate(value, where)),
    targetCents: nullable(item.targetCents, (value) => cents(value, where)),
    archived: bool(item.archived, where, false),
  };
  if (item.note !== undefined && item.note !== null) clean.note = str(item.note, where);
  if (item.accent !== undefined && item.accent !== null) clean.accent = oneOf(item.accent, ACCENTS, where);
  if (item.categories !== undefined && item.categories !== null) {
    const categories = list(item.categories, where);
    if (categories.length > 60) fail(where);
    clean.categories = categories.map((value): SheetCategory => {
      const part = record(value, where);
      return { name: str(part.name, where), bucket: oneOf(part.bucket, SLICES, where) };
    });
  }
  if (item.split !== undefined && item.split !== null) clean.split = split(item.split, where);
  return clean;
}

function goal(raw: unknown, index: number): Goal {
  const where = `meta ${index + 1}`;
  const item = record(raw, where);
  return {
    id: id(item.id, where),
    name: str(item.name, where),
    targetCents: cents(item.targetCents, where),
    savedCents: cents(item.savedCents, where),
    note: item.note === undefined ? "" : str(item.note, where),
  };
}

function message(raw: unknown, index: number): ChatMessage {
  const where = `mensagem ${index + 1}`;
  const item = record(raw, where);
  return {
    id: id(item.id, where),
    sheetId: id(item.sheetId, where),
    role: oneOf(item.role, ROLES, where),
    text: str(item.text, where, MAX_MESSAGE),
    at: str(item.at, where, MAX_ID),
  };
}

function profile(raw: unknown): Profile {
  const where = "perfil";
  const item = record(raw, where);
  const photo = item.photoDataUrl;
  if (photo !== null && photo !== undefined && typeof photo !== "string") fail(where);
  return {
    name: str(item.name, where, 80),
    handle: str(item.handle, where, 80),
    banner: oneOf(item.banner, BANNERS, where),
    // O tamanho e o formato da foto ficam com safePhoto, que o scrubLedger aplica depois.
    photoDataUrl: typeof photo === "string" ? photo : null,
    tone: oneOf(item.tone, TONES, where),
    showPatrimony: bool(item.showPatrimony, where, true),
  };
}

export function validateLedger(value: unknown): Validated {
  try {
    const root = record(value, "planilha");
    const sheets = list(root.sheets, "planilhas");
    const entries = list(root.entries, "lançamentos");
    const goals = list(root.goals, "metas");
    const messages = list(root.messages, "mensagens");
    if (sheets.length > 400 || entries.length > 20_000 || goals.length > 200 || messages.length > 5_000) {
      fail("quantidade de itens");
    }
    return {
      ok: true,
      ledger: {
        profile: profile(root.profile),
        sheets: sheets.map(sheet),
        entries: entries.map(entry),
        goals: goals.map(goal),
        messages: messages.map(message),
      },
    };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, message: error.message };
    return { ok: false, message: "Algum dado ficou inválido. Recarregue a página e tente de novo." };
  }
}
