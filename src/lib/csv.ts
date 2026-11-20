import { ENTRY_LABEL, type Entry } from "./types";

// Transforma os bytes de um arquivo enviado em texto. Tira o BOM, lê UTF-8 e, se os bytes não forem
// UTF-8 válido (o "CSV" do Excel no Windows sai em Windows-1252), lê como windows-1252.
export function decodeCsvBytes(bytes: ArrayBuffer): string {
  const data = new Uint8Array(bytes);
  if (data[0] === 0xff && data[1] === 0xfe) return new TextDecoder("utf-16le").decode(data.subarray(2));
  if (data[0] === 0xfe && data[1] === 0xff) return new TextDecoder("utf-16be").decode(data.subarray(2));
  const body = data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf ? data.subarray(3) : data;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(body).replace(/^﻿/, "");
  }
}

const HEADER = ["Data", "Descrição", "Tipo", "Categoria", "Valor", "Vence dia", "Parcela"];

function cell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// O Excel trata texto que começa com = + - @ como fórmula. Um apóstrofo na frente trava isso
// e o leitor de CSV da planilha tira o apóstrofo na volta.
function text(value: string): string {
  return cell(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);
}

function day(iso: string): string {
  const [year, month, date] = iso.split("-");
  return year && month && date ? `${date}/${month}/${year}` : iso;
}

function amount(entry: Entry): string {
  const abs = Math.abs(entry.cents);
  const digits = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
  if (abs === 0 || entry.type === "receita") return digits;
  return `-${digits}`;
}

// CSV para abrir direto no Excel em português: BOM, ";" entre colunas, CRLF e vírgula decimal.
// Receita sai positiva e todo o resto sai negativo.
export function entriesToCsv(entries: Entry[]): string {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const lines = sorted.map((entry) =>
    [
      day(entry.date),
      text(entry.title),
      ENTRY_LABEL[entry.type],
      text(entry.category),
      amount(entry),
      entry.dueDay === null ? "" : String(entry.dueDay),
      entry.installment ? `${entry.installment.current}/${entry.installment.total}` : "",
    ].join(";"),
  );
  return `﻿${[HEADER.join(";"), ...lines].join("\r\n")}\r\n`;
}
