import type { Sheet, SheetAccent, SheetCategory, SheetKind, SheetSplit, SliceKey } from "./types";

export const SLICE_LABEL: Record<SliceKey, string> = {
  essenciais: "Essenciais",
  estilo: "Estilo de vida",
  futuro: "Futuro",
};

export const SLICE_COLOR: Record<SliceKey, string> = {
  essenciais: "#7c5cff",
  estilo: "#ff8aa0",
  futuro: "#b6ffd2",
};

export const ACCENT_COLOR: Record<SheetAccent, string> = {
  violeta: "#7c5cff",
  menta: "#b6ffd2",
  coral: "#ff8aa0",
  ambar: "#ffc56d",
};

export const ACCENT_LABEL: Record<SheetAccent, string> = {
  violeta: "Violeta",
  menta: "Menta",
  coral: "Coral",
  ambar: "Âmbar",
};

const HOUSE: SheetCategory[] = [
  { name: "Moradia", bucket: "essenciais" },
  { name: "Contas", bucket: "essenciais" },
  { name: "Mercado", bucket: "essenciais" },
  { name: "Transporte", bucket: "essenciais" },
  { name: "Saúde", bucket: "essenciais" },
  { name: "Delivery", bucket: "estilo" },
  { name: "Lazer", bucket: "estilo" },
  { name: "Streaming", bucket: "estilo" },
  { name: "Reserva", bucket: "futuro" },
];

const SPLIT_503020: SheetSplit = { essenciais: 50, estilo: 30, futuro: 20 };

export type SheetTemplate = {
  id: string;
  name: string;
  blurb: string;
  kind: SheetKind;
  categories: SheetCategory[];
  split: SheetSplit;
  accent: SheetAccent;
};

export const TEMPLATES: SheetTemplate[] = [
  {
    id: "casa",
    name: "Mês em casa",
    blurb: "Contas da casa e a divisão 50/30/20.",
    kind: "mensal",
    categories: HOUSE,
    split: SPLIT_503020,
    accent: "violeta",
  },
  {
    id: "viagem",
    name: "Viagem",
    blurb: "Passagem, estadia e o passeio.",
    kind: "meta",
    categories: [
      { name: "Passagem", bucket: "estilo" },
      { name: "Hospedagem", bucket: "estilo" },
      { name: "Comida", bucket: "estilo" },
      { name: "Passeio", bucket: "estilo" },
      { name: "Seguro", bucket: "essenciais" },
      { name: "Reserva", bucket: "futuro" },
    ],
    split: { essenciais: 15, estilo: 70, futuro: 15 },
    accent: "coral",
  },
  {
    id: "reserva",
    name: "Reserva",
    blurb: "Um cofre com meta e aportes.",
    kind: "meta",
    categories: [
      { name: "Aporte", bucket: "futuro" },
      { name: "Rendimento", bucket: "futuro" },
    ],
    split: { essenciais: 0, estilo: 0, futuro: 100 },
    accent: "menta",
  },
  {
    id: "freelance",
    name: "Freelance",
    blurb: "Clientes, imposto e ferramenta.",
    kind: "continuo",
    categories: [
      { name: "Cliente", bucket: "estilo" },
      { name: "Imposto", bucket: "essenciais" },
      { name: "Ferramenta", bucket: "essenciais" },
      { name: "Pró-labore", bucket: "futuro" },
    ],
    split: { essenciais: 30, estilo: 20, futuro: 50 },
    accent: "ambar",
  },
  {
    id: "obra",
    name: "Reforma",
    blurb: "Material, obra e o imprevisto.",
    kind: "meta",
    categories: [
      { name: "Material", bucket: "essenciais" },
      { name: "Mão de obra", bucket: "essenciais" },
      { name: "Móveis", bucket: "estilo" },
      { name: "Imprevisto", bucket: "estilo" },
    ],
    split: { essenciais: 60, estilo: 30, futuro: 10 },
    accent: "ambar",
  },
  {
    id: "branco",
    name: "Em branco",
    blurb: "Você nomeia cada categoria.",
    kind: "mensal",
    categories: [],
    split: SPLIT_503020,
    accent: "violeta",
  },
];

export type SheetDraft = {
  name: string;
  kind: SheetKind;
  month: string | null;
  deadline: string | null;
  targetCents: number | null;
  note: string;
  accent: SheetAccent;
  categories: SheetCategory[];
  split: SheetSplit;
};

export function categoriesOf(sheet: Sheet): SheetCategory[] {
  if (Array.isArray(sheet.categories)) return sheet.categories;
  return HOUSE;
}

export function splitOf(sheet: Sheet): SheetSplit {
  const split = sheet.split;
  if (!split) return SPLIT_503020;
  const total = split.essenciais + split.estilo + split.futuro;
  if (total !== 100 || [split.essenciais, split.estilo, split.futuro].some((part) => part < 0)) return SPLIT_503020;
  return split;
}

export function accentOf(sheet: Sheet): SheetAccent {
  if (sheet.accent && sheet.accent in ACCENT_COLOR) return sheet.accent;
  return "violeta";
}

export function draftFromSheet(sheet: Sheet, month: string): SheetDraft {
  return {
    name: sheet.name,
    kind: sheet.kind,
    month: sheet.month ?? month,
    deadline: sheet.deadline,
    targetCents: sheet.targetCents,
    note: sheet.note ?? "",
    accent: accentOf(sheet),
    categories: categoriesOf(sheet).map((item) => ({ ...item })),
    split: { ...splitOf(sheet) },
  };
}

export function sheetFromDraft(id: string, draft: SheetDraft, archived = false): Sheet {
  return {
    id,
    name: draft.name.trim(),
    kind: draft.kind,
    month: draft.kind === "mensal" ? draft.month : null,
    deadline: draft.kind === "meta" ? draft.deadline : null,
    targetCents: draft.kind === "mensal" ? null : draft.targetCents,
    archived,
    note: draft.note.trim(),
    accent: draft.accent,
    categories: draft.categories,
    split: draft.split,
  };
}

export function nextBucket(bucket: SliceKey): SliceKey {
  if (bucket === "essenciais") return "estilo";
  if (bucket === "estilo") return "futuro";
  return "essenciais";
}

export function categoryBucket(sheet: Sheet, name: string): SliceKey | null {
  const key = name.trim().toLocaleLowerCase("pt-BR");
  const found = categoriesOf(sheet).find((item) => item.name.toLocaleLowerCase("pt-BR") === key);
  return found?.bucket ?? null;
}
