"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { SliceChart } from "./slice-chart";
import { SheetForm } from "./sheet-form";
import { decodeCsvBytes, entriesToCsv } from "@/lib/csv";
import { bucketOf, mathFor } from "@/lib/finance";
import { formatBRL, formatDay, monthKey, parseMoney, todayISO } from "@/lib/money";
import { easeOut } from "@/lib/motion";
import { ACCENT_COLOR, accentOf, categoriesOf, draftFromSheet, SLICE_COLOR, SLICE_LABEL, splitOf } from "@/lib/sheets";
import { useStore } from "@/lib/store";
import { ENTRY_LABEL, KIND_LABEL, type Entry, type EntryType, type Sheet, type SliceKey } from "@/lib/types";
import { Button, Field, Modal, fieldClass } from "./ui";

const types: EntryType[] = ["receita", "fixo", "variavel", "assinatura", "investimento"];

export function SheetStage({ sheetId, compact = false }: { sheetId: string; compact?: boolean }) {
  const { state, addEntry, removeEntry, restoreEntry, archiveSheet, duplicateMonth, clearSheet, importRows, updateSheet, scope } = useStore();
  const sheet = state.sheets.find((item) => item.id === sheetId);
  const numbers = useMemo(() => (sheet ? mathFor(state, sheet) : null), [sheet, state]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"limpar" | "arquivar" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Entry | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), 8000);
    return () => clearTimeout(timer);
  }, [removed]);

  if (!sheet || !numbers) {
    return <p className="p-6 text-muted">Essa planilha não está mais aqui.</p>;
  }

  const entries = state.entries
    .filter((entry) => entry.sheetId === sheet.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const split = splitOf(sheet);
  const accent = ACCENT_COLOR[accentOf(sheet)];
  const splitBase = numbers.income > 0 ? numbers.income : numbers.essenciais + numbers.estilo + numbers.futuro;
  const categories = categoriesOf(sheet);
  const saved = numbers.invested;
  const target = sheet.targetCents ?? 0;
  const bucketByCategory = new Map<string, SliceKey>();
  const sliceCategories: Record<SliceKey, Map<string, number>> = { essenciais: new Map(), estilo: new Map(), futuro: new Map() };
  for (const entry of entries) {
    const bucket = bucketOf(entry, sheet);
    if (!bucket) continue;
    if (!bucketByCategory.has(entry.category)) bucketByCategory.set(entry.category, bucket);
    sliceCategories[bucket].set(entry.category, (sliceCategories[bucket].get(entry.category) ?? 0) + entry.cents);
  }
  const topBySlice = (key: SliceKey) =>
    [...sliceCategories[key].entries()]
      .map(([category, cents]) => ({ category, cents }))
      .sort((a, b) => b.cents - a.cents)
      .slice(0, 3);
  const fixedCount = entries.filter((entry) => entry.type === "fixo").length;
  const subscriptionCount = entries.filter((entry) => entry.type === "assinatura").length;

  const remove = (entry: Entry) => {
    removeEntry(entry.id);
    setRemoved(entry);
  };

  const exportCsv = () => {
    if (entries.length === 0) {
      setNotice("Nada para exportar nesta planilha.");
      return;
    }
    const slug =
      sheet.name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "planilha";
    const blob = new Blob([entriesToCsv([...entries].reverse())], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lamina-${slug}-${sheet.month ?? todayISO()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Planilha exportada em CSV para o Excel.");
  };

  const importFile = async (file: File) => {
    if (/\.xlsx?$/i.test(file.name)) {
      setNotice("Arquivos do Excel (.xlsx) precisam ser salvos como CSV: no Excel, Arquivo, Salvar como, CSV UTF-8.");
      return;
    }
    const { readCsv } = await import("@/lib/finance");
    const { rows, skipped } = readCsv(decodeCsvBytes(await file.arrayBuffer()));
    if (!rows.length) {
      setNotice("O CSV precisa das colunas descricao e valor.");
      return;
    }
    importRows(sheet.id, rows);
    const left = skipped ? ` ${skipped} ficaram de fora por falta de descrição ou valor.` : "";
    setNotice(`${rows.length} ${rows.length === 1 ? "linha entrou" : "linhas entraram"} na planilha.${left}`);
  };

  return (
    <section className="@container flex w-full min-w-0 max-w-full flex-col">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-4">
        <div className="min-w-0">
          <p className="kicker">{KIND_LABEL[sheet.kind]}</p>
          <h1 className="display mt-1 text-3xl sm:text-4xl">{sheet.name}</h1>
          {sheet.note ? <p className="mt-2 max-w-xl text-sm text-muted">{sheet.note}</p> : null}
          {numbers.closed ? <p className="mt-2 text-sm text-amber">Ciclo fechado. O balanço deste mês já virou.</p> : null}
          {target > 0 ? (
            <div className="mt-3 max-w-xs">
              <p className="text-sm text-muted">
                {formatBRL(saved)} de {formatBRL(target)}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas">
                <div className="bar-draw h-full rounded-full" style={{ "--scale": String(Math.min(1, saved / target)), background: accent } as CSSProperties} />
              </div>
            </div>
          ) : null}
          {Array.isArray(sheet.categories) && sheet.categories.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {sheet.categories.map((item) => (
                <li key={item.name} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                  <span className="size-1.5 rounded-full" style={{ background: SLICE_COLOR[item.bucket] }} />
                  {item.name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => setOpen(true)}>
            Novo lançamento
          </Button>
          <Button type="button" tone="ghost" onClick={() => fileRef.current?.click()}>
            Importar CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,.xlsx,.xls"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importFile(file);
            }}
          />
          <MoreMenu
            items={[
              { label: "Personalizar", onSelect: () => setEditing(true) },
              ...(sheet.kind === "mensal"
                ? [
                    {
                      label: "Duplicar mês",
                      onSelect: () => {
                        const id = duplicateMonth(sheet.id);
                        setNotice(id ? "Mês seguinte criado com salário, fixos e assinaturas." : "O mês seguinte já existe.");
                      },
                    },
                  ]
                : []),
              { label: "Exportar CSV (Excel)", onSelect: exportCsv },
              { label: "Arquivar", danger: true, onSelect: () => setConfirm("arquivar") },
              { label: "Limpar lançamentos", danger: true, onSelect: () => setConfirm("limpar") },
            ]}
          />
        </div>
      </header>

      <div aria-live="polite">
        {notice ? <p className="px-4 pt-3 text-sm text-violet-2">{notice}</p> : null}
        {removed ? (
          <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2 text-sm">
            <span>
              Removido: {removed.title}, {formatBRL(removed.cents)}.
            </span>
            <button
              type="button"
              className="press min-h-9 rounded-full border border-line px-3 hover:border-violet-2"
              onClick={() => {
                restoreEntry(removed);
                setRemoved(null);
              }}
            >
              Desfazer
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-3 px-4 py-4">
        <Stat label="Entradas" value={formatBRL(numbers.income)} tone="text-mint" />
        <Stat label="Saídas" value={formatBRL(numbers.burn)} tone="text-coral" />
        <Stat label="Livre" value={formatBRL(numbers.free)} tone={numbers.free < 0 ? "text-coral" : "text-ink"} />
      </div>

      <div className="grid min-w-0 gap-4 px-4 pb-4 @2xl:grid-cols-2 @5xl:grid-cols-[1.1fr_0.9fr_1fr]">
        <div className="@container min-w-0 rounded-2xl border border-line bg-surface p-4 @2xl:col-span-2 @5xl:col-span-1">
          <p className="kicker">Divisão do mês</p>
          <dl className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-x-4 gap-y-2">
            <Fact label="Renda do mês" value={formatBRL(numbers.income)} />
            <Fact label="Gasto" value={formatBRL(numbers.burn)} />
            <Fact label="Guardado" value={formatBRL(numbers.futuro)} />
            <Fact label="Livre" value={formatBRL(numbers.free)} tone={numbers.free < 0 ? "text-coral" : undefined} />
          </dl>
          {numbers.income <= 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-line px-3 py-2 text-sm leading-relaxed text-muted">
              Lance primeiro a renda do mês para calcular o plano de cada fatia. Pelo agente, escreva “meu salário é R$ 5.400” ou “vale alimentação de 350 reais”.
            </p>
          ) : null}
          <div className="mt-4 grid gap-5 @xl:grid-cols-3">
            {(["essenciais", "estilo", "futuro"] as const).map((key, index) => {
              const used = numbers[key];
              const percent = split[key];
              const plan = Math.round((numbers.income * percent) / 100);
              const diff = plan - used;
              const top = topBySlice(key);
              return (
                <Split
                  key={key}
                  label={SLICE_LABEL[key]}
                  actual={used}
                  income={splitBase}
                  target={percent / 100}
                  color={SLICE_COLOR[key]}
                  delay={index * 0.06}
                  suffix={numbers.income > 0 ? " da renda" : " das saídas"}
                >
                  <p className="mt-2 text-sm text-muted">
                    {numbers.income > 0 ? (
                      <>
                        Plano {percent}%: <span className="num">{formatBRL(plan)}</span>
                      </>
                    ) : (
                      <>Plano {percent}% da renda</>
                    )}
                  </p>
                  {numbers.income > 0 ? (
                    <p className={`text-sm ${diff < 0 ? "text-coral" : "text-muted"}`}>
                      {diff < 0 ? "Passou " : "Cabe ainda "}
                      <span className="num">{formatBRL(Math.abs(diff))}</span>
                    </p>
                  ) : null}
                  {top.length === 0 ? (
                    <p className="mt-2 text-xs text-muted">Nada lançado nesta fatia</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {top.map((item) => (
                        <li key={item.category} className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted">
                          <span className="min-w-0 break-words">{item.category}</span>
                          <span className="num">{formatBRL(item.cents)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Split>
              );
            })}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            {entries.length} {entries.length === 1 ? "lançamento" : "lançamentos"}, {fixedCount} {fixedCount === 1 ? "fixo" : "fixos"}, {subscriptionCount}{" "}
            {subscriptionCount === 1 ? "assinatura" : "assinaturas"}. A marca fina na barra é a divisão que você escolheu, {split.essenciais}/{split.estilo}/{split.futuro}.
          </p>
        </div>
        <SliceChart essenciais={numbers.essenciais} estilo={numbers.estilo} futuro={numbers.futuro} />
        <CategoryList items={numbers.byCategory.slice(0, 6)} bucketOfCategory={(name) => bucketByCategory.get(name) ?? "estilo"} />
      </div>

      <div className={`w-full min-w-0 max-w-full px-4 pb-6 ${compact ? "max-h-80 overflow-y-auto" : ""}`}>
        {entries.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-6 text-sm text-muted">
            Nada lançado. Use Novo lançamento ou escreva no agente: “Gastei R$ 32 no café”.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-line border-y border-line md:hidden">
              {entries.map((entry) => (
                <li key={entry.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words">{entry.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {formatDay(entry.date)}, {entry.category}, <Tag type={entry.type} />
                      </p>
                    </div>
                    <p className={`num shrink-0 text-sm ${entry.type === "receita" ? "text-mint" : "text-ink"}`}>
                      {entry.type === "receita" ? "+" : "−"}
                      {formatBRL(entry.cents)}
                    </p>
                  </div>
                  <div className="mt-1 flex justify-end">
                    <RemoveButton entry={entry} onRemove={remove} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="sr-only">Lançamentos de {sheet.name}</caption>
                <thead className="text-muted">
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
                      <td className="py-2 text-muted">{formatDay(entry.date)}</td>
                      <td className="py-2">
                        {entry.title}
                        {entry.installment ? (
                          <span className="ml-2 rounded-full bg-canvas px-2 py-0.5 text-xs text-amber">
                            {entry.installment.current}/{entry.installment.total}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2">
                        <Tag type={entry.type} />
                      </td>
                      <td className="py-2 text-muted">{entry.category}</td>
                      <td className={`num py-2 text-right ${entry.type === "receita" ? "text-mint" : "text-ink"}`}>
                        {entry.type === "receita" ? "+" : "−"}
                        {formatBRL(entry.cents)}
                      </td>
                      <td className="py-2 text-right">
                        <RemoveButton entry={entry} onRemove={remove} />
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
        categories={categories.map((item) => item.name)}
        onClose={() => setOpen(false)}
        onSave={(draft) => {
          addEntry(sheet.id, draft);
          setOpen(false);
        }}
      />
      <Modal open={editing} title="Personalizar planilha" onClose={() => setEditing(false)} wide>
        <SheetForm
          mode="edit"
          defaultMonth={sheet.month ?? monthKey(todayISO())}
          initial={draftFromSheet(sheet, sheet.month ?? monthKey(todayISO()))}
          onSubmit={(draft) => {
            updateSheet(sheet.id, draft);
            setEditing(false);
          }}
        />
      </Modal>
      <ConfirmDialog
        confirm={confirm}
        sheet={sheet}
        scope={scope}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === "limpar") clearSheet(sheet.id);
          if (confirm === "arquivar") archiveSheet(sheet.id);
          setConfirm(null);
        }}
      />
    </section>
  );
}

function ConfirmDialog({
  confirm,
  sheet,
  scope,
  onClose,
  onConfirm,
}: {
  confirm: "limpar" | "arquivar" | null;
  sheet: Sheet;
  scope: "demo" | "conta";
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={confirm !== null} title={confirm === "limpar" ? `Limpar ${sheet.name}?` : `Arquivar ${sheet.name}?`} onClose={onClose}>
      <p className="text-sm leading-relaxed text-muted">
        {confirm === "limpar"
          ? "Somem todas as linhas desta planilha. Metas e as outras folhas ficam. Não dá para desfazer."
          : scope === "conta"
            ? "Ela sai da tela inicial. O histórico continua na conta, cifrado."
            : "Ela sai da tela inicial. O histórico continua nesta demonstração."}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" tone="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" className={confirm === "limpar" ? "bg-[#b4233f] hover:bg-[#9c1d36]" : ""} onClick={onConfirm}>
          {confirm === "limpar" ? "Limpar" : "Arquivar"}
        </Button>
      </div>
    </Modal>
  );
}

function MoreMenu({ items }: { items: { label: string; danger?: boolean; onSelect: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <Button type="button" tone="ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        Mais
      </Button>
      {open ? (
        <ul role="menu" className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-surface-2 py-1">
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className={`flex min-h-11 w-full items-center px-4 text-left text-sm hover:bg-surface ${item.danger ? "text-coral" : "text-ink"}`}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function RemoveButton({ entry, onRemove }: { entry: Entry; onRemove: (entry: Entry) => void }) {
  return (
    <button
      type="button"
      className="min-h-9 rounded-full px-3 text-xs text-muted hover:bg-surface hover:text-coral"
      aria-label={`Remover ${entry.title}, ${formatBRL(entry.cents)}`}
      onClick={() => onRemove(entry)}
    >
      Remover
    </button>
  );
}

function CategoryList({ items, bucketOfCategory }: { items: { category: string; cents: number }[]; bucketOfCategory: (name: string) => SliceKey }) {
  const max = Math.max(...items.map((item) => item.cents), 1);
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <p className="kicker">Por categoria</p>
      {items.length === 0 ? <p className="mt-4 text-sm text-muted">Sem gastos lançados.</p> : null}
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.category}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="min-w-0 break-words">{item.category}</span>
              <span className="num text-muted">{formatBRL(item.cents)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-canvas">
              <div
                className="bar-draw h-full rounded-full"
                style={{ "--scale": String(item.cents / max), background: SLICE_COLOR[bucketOfCategory(item.category)] } as CSSProperties}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface px-4 py-3">
      <p className="kicker">{label}</p>
      <p className={`num mt-1 text-2xl break-all ${tone}`}>{value}</p>
    </div>
  );
}

export function Split({
  label,
  actual,
  income,
  target,
  color,
  delay,
  suffix = "",
  children,
}: {
  label: string;
  actual: number;
  income: number;
  target: number;
  color: string;
  delay: number;
  suffix?: string;
  children?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const ratio = income > 0 ? actual / income : 0;
  const scale = Math.min(1, ratio);
  return (
    <div className="min-w-0">
      <div className="mb-1 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
          {label}
        </span>
        <span className="num text-muted">
          {formatBRL(actual)}, {Math.round(ratio * 100)}%{suffix}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-canvas">
        <motion.div
          className="h-2 rounded-full"
          style={{ background: color, transformOrigin: "left center" }}
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: scale }}
          transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : delay, ease: easeOut }}
        />
        <span className="pointer-events-none absolute top-[-3px] h-3.5 w-px bg-ink" style={{ left: `${Math.min(100, target * 100)}%` }} aria-hidden="true" />
      </div>
      {children}
    </div>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="kicker">{label}</dt>
      <dd className={`num mt-0.5 text-sm ${tone ?? "text-ink"}`}>{value}</dd>
    </div>
  );
}

function Tag({ type }: { type: EntryType }) {
  return <span className={`text-xs ${type === "receita" ? "text-mint" : "text-muted"}`}>{ENTRY_LABEL[type]}</span>;
}

function EntryDialog({
  open,
  categories,
  onClose,
  onSave,
}: {
  open: boolean;
  categories: string[];
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
  const [category, setCategory] = useState(categories[0] ?? "Mercado");
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
            {categories.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {categories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={category === item}
                    className={`rounded-full border px-2 py-1 text-xs ${category === item ? "border-violet text-ink" : "border-line text-muted"}`}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
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
