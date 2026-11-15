"use client";

import { FormEvent, useMemo, useState } from "react";
import { SliceChart } from "./slice-chart";
import { mathFor } from "@/lib/finance";
import { formatBRL, formatDay, parseMoney, todayISO } from "@/lib/money";
import { useStore } from "@/lib/store";
import { ENTRY_LABEL, KIND_LABEL, type EntryType } from "@/lib/types";
import { Button, Field, Modal, fieldClass } from "./ui";

const types: EntryType[] = ["receita", "fixo", "variavel", "assinatura", "investimento"];

export function SheetStage({ sheetId, compact = false }: { sheetId: string; compact?: boolean }) {
  const { state, addEntry, removeEntry, archiveSheet, duplicateMonth, clearSheet, importRows } = useStore();
  const sheet = state.sheets.find((item) => item.id === sheetId);
  const numbers = useMemo(() => (sheet ? mathFor(state, sheet) : null), [sheet, state]);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<"limpar" | "arquivar" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!sheet || !numbers) {
    return <p className="p-6 text-muted">Essa planilha não está mais aqui.</p>;
  }

  const entries = state.entries
    .filter((entry) => entry.sheetId === sheet.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section className="flex w-full min-w-0 max-w-full flex-col">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-4">
        <div>
          <p className="kicker">{KIND_LABEL[sheet.kind]}</p>
          <h1 className="display mt-2 text-3xl sm:text-4xl">{sheet.name}</h1>
          {numbers.closed ? <p className="mt-2 text-sm text-amber">Ciclo fechado. O balanço deste mês já virou.</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setOpen(true)}>
            Novo lançamento
          </Button>
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line px-4 text-sm hover:border-violet-2">
            Importar CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const { parseCsv } = await import("@/lib/finance");
                const rows = parseCsv(await file.text());
                if (!rows.length) {
                  setNotice("O CSV precisa de descricao e valor.");
                  return;
                }
                importRows(sheet.id, rows);
                setNotice(`${rows.length} linhas entraram na planilha.`);
              }}
            />
          </label>
          {sheet.kind === "mensal" ? (
            <Button
              type="button"
              tone="ghost"
              onClick={() => {
                const id = duplicateMonth(sheet.id);
                setNotice(id ? "Mês seguinte criado com salário, fixos e assinaturas." : "O mês seguinte já existe.");
              }}
            >
              Duplicar mês
            </Button>
          ) : null}
          <Button type="button" tone="ghost" onClick={() => setConfirm("limpar")}>
            Limpar
          </Button>
          <Button type="button" tone="ghost" onClick={() => setConfirm("arquivar")}>
            Arquivar
          </Button>
        </div>
      </header>

      {notice ? <p className="px-4 pt-3 text-sm text-violet-2">{notice}</p> : null}

      <div className="grid gap-3 px-4 py-4 sm:grid-cols-3">
        <Stat label="Entradas" value={formatBRL(numbers.income)} tone="text-mint" />
        <Stat label="Saídas" value={formatBRL(numbers.burn)} tone="text-coral" />
        <Stat label="Livre" value={formatBRL(numbers.free)} tone="text-ink" />
      </div>

      <div className="grid gap-4 px-4 pb-4 lg:grid-cols-[1.1fr_0.9fr_1fr]">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="kicker">Divisão do mês</p>
          <div className="mt-4 space-y-3">
            <Split label="Essenciais" actual={numbers.essenciais} income={numbers.income} target={0.5} />
            <Split label="Estilo de vida" actual={numbers.estilo} income={numbers.income} target={0.3} />
            <Split label="Futuro" actual={numbers.futuro} income={numbers.income} target={0.2} />
          </div>
          <p className="mt-3 text-xs text-faint">
            A marca fina é a meta 50/30/20. A barra é o que já saiu de {formatBRL(numbers.income || 0)}.
          </p>
        </div>
        <SliceChart essenciais={numbers.essenciais} estilo={numbers.estilo} futuro={numbers.futuro} />
        <CategoryBars items={numbers.byCategory.slice(0, 6)} />
      </div>

      <div className={`w-full min-w-0 max-w-full px-4 pb-6 ${compact ? "max-h-80 overflow-y-auto" : ""}`}>
        {entries.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-6 text-sm text-muted">
            Nada lançado. Use Novo lançamento ou escreva no agente: “Gastei R$ 32 no café”.
          </p>
        ) : (
          <>
            <ul className="space-y-2 md:hidden">
              {entries.map((entry) => (
                <li key={entry.id} className="rounded-2xl border border-line bg-surface px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p>{entry.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {formatDay(entry.date)} · {entry.category}
                      </p>
                    </div>
                    <p className={`num text-sm ${entry.type === "receita" ? "text-mint" : "text-ink"}`}>
                      {entry.type === "receita" ? "+" : "−"}
                      {formatBRL(entry.cents)}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <Tag type={entry.type} />
                    <button type="button" className="text-xs text-faint" onClick={() => removeEntry(entry.id)}>
                      Remover
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Lançamentos de {sheet.name}</caption>
            <thead className="text-faint">
              <tr>
                <th className="py-2 font-normal">Data</th>
                <th className="py-2 font-normal">Descrição</th>
                <th className="py-2 font-normal">Tipo</th>
                <th className="py-2 font-normal">Categoria</th>
                <th className="py-2 text-right font-normal">Valor</th>
                <th className="py-2 font-normal">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-line">
                  <td className="py-3 text-muted">{formatDay(entry.date)}</td>
                  <td className="py-3">
                    {entry.title}
                    {entry.installment ? (
                      <span className="ml-2 rounded-full bg-canvas px-2 py-0.5 text-xs text-amber">
                        {entry.installment.current}/{entry.installment.total}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3">
                    <Tag type={entry.type} />
                  </td>
                  <td className="py-3 text-muted">{entry.category}</td>
                  <td className={`num py-3 text-right ${entry.type === "receita" ? "text-mint" : "text-ink"}`}>
                    {entry.type === "receita" ? "+" : "−"}
                    {formatBRL(entry.cents)}
                  </td>
                  <td className="py-3 text-right">
                    <button type="button" className="text-xs text-faint hover:text-coral" onClick={() => removeEntry(entry.id)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
            </div>
          </>
        )}
      </div>

      <EntryDialog
        open={open}
        onClose={() => setOpen(false)}
        onSave={(draft) => {
          addEntry(sheet.id, draft);
          setOpen(false);
        }}
      />
      <Modal open={confirm !== null} title={confirm === "limpar" ? "Limpar lançamentos?" : "Arquivar planilha?"} onClose={() => setConfirm(null)}>
        <p className="text-sm leading-relaxed text-muted">
          {confirm === "limpar"
            ? "Some só as linhas desta planilha. Metas e as outras folhas ficam."
            : "Ela sai da tela inicial. O histórico continua guardado neste navegador."}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" tone="ghost" onClick={() => setConfirm(null)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (confirm === "limpar") clearSheet(sheet.id);
              if (confirm === "arquivar") archiveSheet(sheet.id);
              setConfirm(null);
            }}
          >
            Confirmar
          </Button>
        </div>
      </Modal>
    </section>
  );
}

function CategoryBars({ items }: { items: { category: string; cents: number }[] }) {
  const max = Math.max(...items.map((item) => item.cents), 1);
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="kicker">Por categoria</p>
      {items.length === 0 ? <p className="mt-4 text-sm text-muted">Sem gastos lançados.</p> : null}
      <div className="mt-4 flex h-28 items-end gap-2">
        {items.map((item) => (
          <button
            key={item.category}
            type="button"
            title={`${item.category}: ${formatBRL(item.cents)}`}
            aria-label={`${item.category}: ${formatBRL(item.cents)}`}
            className="flex h-full min-w-0 flex-1 items-end"
          >
            <span
              className="block w-full rounded-t-md bg-violet"
              style={{ height: `${Math.max(12, Math.round((item.cents / max) * 100))}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {items.map((item) => (
          <span key={item.category} className="min-w-0 flex-1 truncate text-center text-[10px] text-faint">
            {item.category}
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      <p className="kicker">{label}</p>
      <p className={`num mt-2 text-2xl ${tone}`}>{value}</p>
    </div>
  );
}

function Split({
  label,
  actual,
  income,
  target,
}: {
  label: string;
  actual: number;
  income: number;
  target: number;
}) {
  const ratio = income > 0 ? actual / income : 0;
  const width = Math.min(100, ratio * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="num text-muted">
          {formatBRL(actual)} · {Math.round(ratio * 100)}%
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-canvas">
        <div className="h-2 rounded-full bg-violet" style={{ width: `${width}%` }} />
        <span className="absolute top-[-3px] h-3.5 w-px bg-ink" style={{ left: `${target * 100}%` }} />
      </div>
    </div>
  );
}

function Tag({ type }: { type: EntryType }) {
  const tone =
    type === "receita" ? "text-mint" : type === "investimento" ? "text-amber" : type === "assinatura" ? "text-violet-2" : "text-coral";
  return <span className={`text-xs ${tone}`}>{ENTRY_LABEL[type]}</span>;
}

function EntryDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (draft: {
    type: EntryType;
    title: string;
    category: string;
    cents: number;
    date: string;
    dueDay: number | null;
    installment: { current: number; total: number } | null;
  }) => void;
}) {
  const [type, setType] = useState<EntryType>("variavel");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Mercado");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [due, setDue] = useState("");
  const [parcel, setParcel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cents = parseMoney(amount);
    if (!title.trim() || cents === null || cents === 0) {
      setError("Preencha descrição e um valor maior que zero.");
      return;
    }
    const match = parcel.match(/^(\d+)\s*\/\s*(\d+)$/);
    onSave({
      type,
      title: title.trim(),
      category: category.trim() || "Outros",
      cents,
      date,
      dueDay: due ? Number(due) : null,
      installment: match ? { current: Number(match[1]), total: Number(match[2]) } : null,
    });
    setTitle("");
    setAmount("");
    setError(null);
  };

  return (
    <Modal open={open} title="Novo lançamento" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        <Field label="Tipo">
          <select className={fieldClass} value={type} onChange={(event) => setType(event.target.value as EntryType)}>
            {types.map((item) => (
              <option key={item} value={item}>
                {ENTRY_LABEL[item]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descrição">
          <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Valor">
            <input className={fieldClass} inputMode="decimal" placeholder="85,00" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Field>
          <Field label="Categoria">
            <input className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Data">
            <input className={fieldClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Vence no dia">
            <input className={fieldClass} inputMode="numeric" placeholder="18" value={due} onChange={(event) => setDue(event.target.value)} />
          </Field>
          <Field label="Parcela">
            <input className={fieldClass} placeholder="3/12" value={parcel} onChange={(event) => setParcel(event.target.value)} />
          </Field>
        </div>
        {error ? <p className="text-sm text-coral">{error}</p> : null}
        <div className="flex justify-end">
          <Button type="submit">Lançar</Button>
        </div>
      </form>
    </Modal>
  );
}
