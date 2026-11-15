export type SheetKind = "mensal" | "meta" | "continuo";

export type SliceKey = "essenciais" | "estilo" | "futuro";

export type SheetAccent = "violeta" | "menta" | "coral" | "ambar";

export type SheetCategory = {
  name: string;
  bucket: SliceKey;
};

export type SheetSplit = {
  essenciais: number;
  estilo: number;
  futuro: number;
};

export type EntryType =
  | "receita"
  | "fixo"
  | "variavel"
  | "assinatura"
  | "investimento";

export type Entry = {
  id: string;
  sheetId: string;
  type: EntryType;
  title: string;
  category: string;
  cents: number;
  date: string;
  dueDay: number | null;
  installment: { current: number; total: number } | null;
};

export type Sheet = {
  id: string;
  name: string;
  kind: SheetKind;
  month: string | null;
  deadline: string | null;
  targetCents: number | null;
  archived: boolean;
  note?: string;
  accent?: SheetAccent;
  categories?: SheetCategory[];
  split?: SheetSplit;
};

export type Goal = {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  note: string;
};

export type ChatMessage = {
  id: string;
  sheetId: string;
  role: "user" | "agent";
  text: string;
  at: string;
};

export type Banner = "violeta" | "noite" | "papel";
export type Tone = "direto" | "calmo";

export type Profile = {
  name: string;
  handle: string;
  banner: Banner;
  photoDataUrl: string | null;
  tone: Tone;
  showPatrimony: boolean;
};

export type LedgerState = {
  profile: Profile;
  sheets: Sheet[];
  entries: Entry[];
  goals: Goal[];
  messages: ChatMessage[];
};

export const ENTRY_LABEL: Record<EntryType, string> = {
  receita: "Receita",
  fixo: "Gasto fixo",
  variavel: "Gasto variável",
  assinatura: "Assinatura",
  investimento: "Investimento",
};

export const KIND_LABEL: Record<SheetKind, string> = {
  mensal: "Ciclo mensal",
  meta: "Meta com prazo",
  continuo: "Visão contínua",
};
