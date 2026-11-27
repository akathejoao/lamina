"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PenLine } from "lucide-react";
import { FormError, GrowBar, Rolling } from "./motion-bits";
import { FILL_EVENT } from "@/lib/motion";
import { X } from "lucide-react";
import { SliceChart } from "./slice-chart";
import { SheetForm } from "./sheet-form";
import { CSV_MAX_BYTES, CSV_MAX_ROWS, decodeCsvBytes, entriesToCsv } from "@/lib/csv";
import { bucketOf, mathFor } from "@/lib/finance";
import { formatBRL, formatDay, monthKey, parseMoney, todayISO } from "@/lib/money";
import { easeOut } from "@/lib/motion";
import { ACCENT_COLOR, accentOf, categoriesOf, draftFromSheet, SLICE_COLOR, SLICE_LABEL, splitOf } from "@/lib/sheets";
import { useStore } from "@/lib/store";
import { ENTRY_LABEL, KIND_LABEL, type Entry, type EntryType, type Sheet, type SliceKey } from "@/lib/types";
import { Button, Field, Modal, fieldClass } from "./ui";

const types: EntryType[] = ["receita", "fixo", "variavel", "assinatura", "investimento"];

const bannerMotion = (reduce: boolean | null) => ({
  initial: reduce ? { opacity: 0 } : { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, transition: { duration: 0.12, ease: easeOut } },
  transition: { duration: 0.2, ease: easeOut },
});

// Ids que acabaram de entrar na planilha (digitados, pelo agente ou desfeitos). Importações grandes não ganham destaque.
function useFreshIds(ids: string[]): Set<string> {
  const key = ids.join("|");
  const [seen, setSeen] = useState({ key, ids: new Set(ids) });
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  if (seen.key !== key) {
    const added = ids.filter((id) => !seen.ids.has(id));
    setSeen({ key, ids: new Set(ids) });
    setFresh(added.length > 0 && added.length <= 5 ? new Set(added) : new Set());
  }
  useEffect(() => {
    if (fresh.size === 0) return;
    const timer = setTimeout(() => setFresh(new Set()), 1200);
    return () => clearTimeout(timer);
  }, [fresh]);
  return fresh;
}

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
  const reduceMotion = useReducedMotion();
  const freshIds = useFreshIds(state.entries.filter((entry) => entry.sheetId === sheetId).map((entry) => entry.id));

  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), 8000);
    return () => clearTimeout(timer);
  }, [removed]);

  if (!sheet || !numbers) {
    return (
      <div className="sheet-grid m-4 rounded-lg border border-line p-6">
        <p className="text-muted">Essa planilha não está mais aqui.</p>
        <Link href="/app" className="mt-3 inline-flex min-h-10 items-center text-sm text-violet-2 hover:text-ink">
          Voltar para as planilhas
        </Link>
      </div>
    );
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
    if (file.size > CSV_MAX_BYTES) {
      setNotice(`Esse arquivo tem ${(file.size / 1_000_000).toFixed(1).replace(".", ",")} MB. O limite é ${(CSV_MAX_BYTES / 1_000_000).toFixed(0)} MB por CSV. Divida em partes menores.`);
      return;
    }
    const { readCsv } = await import("@/lib/finance");
    const { rows, skipped } = readCsv(decodeCsvBytes(await file.arrayBuffer()));
    if (!rows.length) {
      setNotice("O CSV precisa das colunas descricao e valor.");
      return;
    }
    if (rows.length + skipped > CSV_MAX_ROWS) {
      setNotice(`Esse CSV tem ${(rows.length + skipped).toLocaleString("pt-BR")} linhas. O limite é ${CSV_MAX_ROWS.toLocaleString("pt-BR")} por importação. Divida o arquivo e importe em partes.`);
      return;
    }
    importRows(sheet.id, rows);
    const left = skipped ? ` ${skipped} ficaram de fora por falta de descrição ou valor.` : "";
    setNotice(`${rows.length} ${rows.length === 1 ? "linha entrou" : "linhas entraram"} na planilha.${left}`);
  };

  return (
    <section className="@container flex w-full min-w-0 max-w-full flex-col">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-4 pt-5 pb-4">
        <div className="min-w-0 flex-1 basis-64">
          <p className="kicker">{KIND_LABEL[sheet.kind]}</p>
          <h1 className="display mt-1.5 text-4xl [overflow-wrap:anywhere] @xl:text-5xl">{sheet.name}</h1>
          {sheet.note ? <p className="mt-2 max-w-xl text-sm text-muted">{sheet.note}</p> : null}
          {numbers.closed ? <p className="mt-2 text-sm text-amber">Ciclo fechado. O balanço deste mês já virou.</p> : null}
          {target > 0 ? (
            <div className="mt-3 max-w-xs">
              <p className="num text-sm text-muted">
                {formatBRL(saved)} de {formatBRL(target)}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <GrowBar className="h-full rounded-full" scale={saved / target} style={{ background: accent }} />
              </div>
            </div>
          ) : null}
          {Array.isArray(sheet.categories) && sheet.categories.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {sheet.categories.map((item) => (
                <li key={item.name} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-0.5 text-xs text-muted">
                  <span className="size-1.5 rounded-full" style={{ background: SLICE_COLOR[item.bucket] }} />
                  {item.name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" className="px-3" onClick={() => setOpen(true)}>
            Novo lançamento
          </Button>
          <Button type="button" tone="ghost" className="px-3" onClick={() => fileRef.current?.click()}>
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

      <div aria-live="polite" className="empty:hidden">
        <AnimatePresence initial={false}>
        {notice ? (
          <motion.p key="notice" className="px-4 pb-3 text-sm text-violet-2" {...bannerMotion(reduceMotion)}>
            {notice}
          </motion.p>
        ) : null}
        {removed ? (
          <motion.div key="removed" {...bannerMotion(reduceMotion)} className="mx-4 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-1.5 text-sm">
            <span className="min-w-0 [overflow-wrap:anywhere]">
              Removido: {removed.title}, <span className="num">{formatBRL(removed.cents)}</span>.
            </span>
            <button
              type="button"
              className="press min-h-10 rounded-md border border-line px-4 hover:border-violet-2"
              onClick={() => {
                restoreEntry(removed);
                setRemoved(null);
              }}
            >
              Desfazer
            </button>
          </motion.div>
        ) : null}
        </AnimatePresence>
      </div>

      <dl className="mx-4 mb-4 grid grid-cols-1 divide-y divide-line border-y border-line @lg:grid-cols-3 @lg:divide-x @lg:divide-y-0">
        <Stat label="Entradas" cents={numbers.income} tone="text-mint" />
        <Stat label="Saídas" cents={numbers.burn} tone="text-ink" />
        <Stat label="Livre" cents={numbers.free} tone={numbers.free < 0 ? "text-coral" : "text-ink"} />
      </dl>

      <div className="w-full min-w-0 max-w-full px-4">
        <div className="blade rounded-lg border border-line bg-surface">
          <div className={compact ? "max-h-80 overflow-y-auto" : ""}>
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">Lançamentos de {sheet.name}</caption>
              <thead>
                <tr className="col-label uppercase">
                  <th scope="col" className="sticky top-0 z-10 hidden w-10 rounded-tl-lg border-r border-b border-line bg-surface-2 py-2 pr-2 text-right font-normal @2xl:table-cell">
                    <span className="sr-only">Linha</span>
                  </th>
                  <th scope="col" className="sticky top-0 z-10 hidden w-20 border-b border-line bg-surface-2 px-3 py-2 font-normal @md:table-cell">
                    Data
                  </th>
                  <th scope="col" className="sticky top-0 z-10 rounded-tl-lg border-b border-line bg-surface-2 px-3 py-2 font-normal @2xl:rounded-none">
                    Descrição
                  </th>
                  <th scope="col" className="sticky top-0 z-10 hidden w-36 border-b border-line bg-surface-2 px-3 py-2 font-normal @xl:table-cell">
                    Categoria
                  </th>
                  <th scope="col" className="sticky top-0 z-10 hidden w-28 border-b border-line bg-surface-2 px-3 py-2 font-normal @3xl:table-cell">
                    Tipo
                  </th>
                  <th scope="col" className="sticky top-0 z-10 w-[7.5rem] border-b border-line bg-surface-2 px-2 py-2 text-right @md:w-[8.5rem] @md:px-3 font-normal">
                    Valor
                  </th>
                  <th scope="col" className="sticky top-0 z-10 w-11 rounded-tr-lg border-b border-line bg-surface-2 py-2 font-normal">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                {entries.map((entry, index) => (
                  <motion.tr
                    key={entry.id}
                    layout={reduceMotion || entries.length > 80 ? false : "position"}
                    initial={freshIds.has(entry.id) && !reduceMotion ? { opacity: 0, y: -6 } : freshIds.has(entry.id) ? { opacity: 0 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.14, ease: easeOut } }}
                    transition={{ duration: 0.24, ease: easeOut, layout: { duration: 0.26, ease: easeOut } }}
                    className={`border-t border-line first:border-t-0 hover:bg-surface-2/50 ${freshIds.has(entry.id) ? "row-new" : ""}`}
                  >
                    <td className="num hidden border-r border-line bg-canvas-2 py-2.5 pr-2 text-right text-xs text-faint @2xl:table-cell">{index + 1}</td>
                    <td className="num hidden px-3 py-2.5 align-top text-xs leading-5 whitespace-nowrap text-muted @md:table-cell">{formatDay(entry.date)}</td>
                    <td className="min-w-0 px-3 py-2.5 align-top">
                      <span className="block [overflow-wrap:anywhere]">
                        {entry.title}
                        {entry.installment ? (
                          <span className="num ml-2 rounded-md bg-canvas px-1.5 py-0.5 text-xs text-amber">
                            {entry.installment.current}/{entry.installment.total}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted @md:hidden">
                        <span className="num">{formatDay(entry.date)}</span>, {entry.category}, <Tag type={entry.type} />
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 align-top text-muted [overflow-wrap:anywhere] @xl:table-cell">{entry.category}</td>
                    <td className="hidden px-3 py-2.5 align-top @3xl:table-cell">
                      <Tag type={entry.type} />
                    </td>
                    <td className={`num px-2 py-2.5 text-right align-top whitespace-nowrap @md:px-3 ${entry.type === "receita" ? "text-mint" : "text-ink"}`}>
                      {entry.type === "receita" ? "+" : "−"}
                      {formatBRL(entry.cents)}
                    </td>
                    <td className="p-0 text-right align-middle">
                      <RemoveButton entry={entry} onRemove={remove} />
                    </td>
                  </motion.tr>
                ))}
                </AnimatePresence>
              </tbody>
            </table>
            {entries.length === 0 ? (
              <div className="sheet-grid px-4 py-10 text-center">
                <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted">
                  Nada lançado. Use Novo lançamento ou escreva no agente: “Gastei R$ 32 no café”.
                </p>
              </div>
            ) : null}
          </div>
          <p className="col-label border-t border-line px-3 py-2 uppercase">
            {entries.length} {entries.length === 1 ? "lançamento" : "lançamentos"}, {fixedCount} {fixedCount === 1 ? "fixo" : "fixos"}, {subscriptionCount}{" "}
            {subscriptionCount === 1 ? "assinatura" : "assinaturas"}
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-x-10 gap-y-8 px-4 pt-8 pb-8">
        <section aria-labelledby={`divisao-${sheet.id}`} className="min-w-0">
          <h2 id={`divisao-${sheet.id}`} className="text-xl">
            Divisão do mês
          </h2>
          <dl className="mt-3 grid grid-cols-2 divide-x divide-line border-y border-line @lg:grid-cols-4">
            <Fact label="Renda do mês" cents={numbers.income} />
            <Fact label="Gasto" cents={numbers.burn} />
            <Fact label="Guardado" cents={numbers.futuro} />
            <Fact label="Livre" cents={numbers.free} tone={numbers.free < 0 ? "text-coral" : undefined} />
          </dl>
          {numbers.income <= 0 ? <IncomeEmpty /> : null}
          <div className="col-label mt-4 hidden grid-cols-[8.5rem_minmax(0,1fr)_6.5rem_6.5rem_6.5rem] gap-x-4 border-b border-line pb-2 uppercase @xl:grid">
            <span>Fatia</span>
            <span>{numbers.income > 0 ? "Da renda" : "Das saídas"}</span>
            <span className="text-right">Real</span>
            <span className="text-right">Plano</span>
            <span className="text-right">Folga</span>
          </div>
          <ul className="ruled">
            {(["essenciais", "estilo", "futuro"] as const).map((key, index) => {
              const used = numbers[key];
              const percent = split[key];
              const plan = Math.round((numbers.income * percent) / 100);
              const diff = plan - used;
              const top = topBySlice(key);
              const ratio = splitBase > 0 ? used / splitBase : 0;
              const hasIncome = numbers.income > 0;
              // Passar do plano é ruim em essenciais e estilo. Em futuro, passar do plano é guardar mais.
              const over = hasIncome && key !== "futuro" && diff < 0;
              return (
                <li
                  key={key}
                  className="grid grid-cols-1 gap-y-2.5 py-4 @xl:grid-cols-[8.5rem_minmax(0,1fr)_6.5rem_6.5rem_6.5rem] @xl:items-center @xl:gap-x-4"
                >
                  <span className="order-1 flex min-w-0 items-center gap-2 text-sm">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: SLICE_COLOR[key] }} aria-hidden="true" />
                    {SLICE_LABEL[key]}
                    <span className="num text-xs text-faint">{percent}%</span>
                  </span>
                  <div className="order-2">
                    <Bar ratio={ratio} target={percent / 100} color={over ? "var(--color-coral)" : SLICE_COLOR[key]} delay={index * 0.06} markerLabel={`plano ${percent}%`} />
                  </div>
                  <div className="order-3 grid grid-cols-3 gap-x-3 @xl:contents">
                    <div className="min-w-0 @xl:order-3 @xl:text-right">
                      <span className="col-label block uppercase @xl:hidden">Real</span>
                      <span className="num block text-sm">
                        <Rolling cents={used} />
                      </span>
                    </div>
                    <div className="min-w-0 @xl:order-4 @xl:text-right">
                      <span className="col-label block uppercase @xl:hidden">Plano</span>
                      <span className="num block text-sm text-muted">{hasIncome ? <Rolling cents={plan} /> : `${percent}% da renda`}</span>
                    </div>
                    <div className="min-w-0 @xl:order-5 @xl:text-right">
                      <span className="col-label block uppercase @xl:hidden">{diff < 0 ? "Passou" : "Folga"}</span>
                      {hasIncome ? (
                        <span className={`num block text-sm ${diff < 0 ? "text-coral" : "text-mint"}`}>
                          {diff < 0 ? "−" : ""}
                          <Rolling cents={Math.abs(diff)} />
                        </span>
                      ) : (
                        <span className="num block text-sm text-faint">—</span>
                      )}
                    </div>
                  </div>
                  <p className="order-6 text-xs leading-relaxed text-muted @xl:col-span-4 @xl:col-start-2">
                    {top.length === 0
                      ? "Nada lançado nesta fatia"
                      : top.map((item, i) => (
                          <span key={item.category}>
                            {i > 0 ? " · " : ""}
                            {item.category} <span className="num">{formatBRL(item.cents)}</span>
                          </span>
                        ))}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-muted">A marca fina na barra é a divisão que você escolheu, {split.essenciais}/{split.estilo}/{split.futuro}.</p>
        </section>

        <div className="grid min-w-0 gap-x-10 gap-y-8 @3xl:grid-cols-2">
          <CategoryList items={numbers.byCategory.slice(0, 6)} bucketOfCategory={(name) => bucketByCategory.get(name) ?? "estilo"} />
          <SliceChart essenciais={numbers.essenciais} estilo={numbers.estilo} futuro={numbers.futuro} />
        </div>
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
  const reduce = useReducedMotion();

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
      <Button type="button" tone="ghost" className="px-3" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        Mais
      </Button>
      <AnimatePresence>
        {open ? (
          <motion.ul
            role="menu"
            className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-lg border border-line bg-surface-2 py-1"
            style={{ transformOrigin: "top right" }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: reduce ? 0.12 : 0.16, ease: easeOut } }}
            exit={{ opacity: 0, transition: { duration: 0.1, ease: easeOut } }}
          >
            {items.map((item) => (
              <li key={item.label} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={`tint flex min-h-11 w-full items-center px-4 text-left text-sm hover:bg-surface ${item.danger ? "text-coral" : "text-ink"}`}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function RemoveButton({ entry, onRemove }: { entry: Entry; onRemove: (entry: Entry) => void }) {
  return (
    <button
      type="button"
      className="press inline-flex size-10 items-center justify-center rounded-md text-faint hover:bg-surface-2 hover:text-coral"
      aria-label={`Remover ${entry.title}, ${formatBRL(entry.cents)}`}
      title="Remover"
      onClick={() => onRemove(entry)}
    >
      <X className="size-4" aria-hidden="true" />
    </button>
  );
}

function CategoryList({ items, bucketOfCategory }: { items: { category: string; cents: number }[]; bucketOfCategory: (name: string) => SliceKey }) {
  const max = Math.max(...items.map((item) => item.cents), 1);
  return (
    <section className="min-w-0" aria-labelledby="por-categoria">
      <h2 id="por-categoria" className="text-xl">
        Por categoria
      </h2>
      {items.length === 0 ? (
        <p className="sheet-grid mt-3 rounded-lg border border-line px-4 py-3 text-sm text-muted">Sem gastos lançados.</p>
      ) : (
        <ul className="ruled mt-3 border-y border-line">
          {items.map((item, index) => (
            <li key={item.category} className="py-2.5">
              <div className="flex items-baseline justify-between gap-x-3 text-sm">
                <span className="min-w-0 [overflow-wrap:anywhere]">{item.category}</span>
                <span className="num shrink-0 text-muted">{formatBRL(item.cents)}</span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-canvas">
                <GrowBar className="h-full rounded-full" scale={item.cents / max} delay={index * 0.06} style={{ background: SLICE_COLOR[bucketOfCategory(item.category)] }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Faixa de totais: rótulo de coluna em cima, número em mono. Vira linhas pautadas quando o espaço aperta.
const EXAMPLES = ["meu salário é R$ 5.400", "vale alimentação de 350 reais", "recebi 800 de freelance"];

// Sem renda lançada não há plano por fatia. O estado vazio ensina a frase e preenche o campo do agente.
function IncomeEmpty() {
  return (
    <div className="mt-4 flex gap-3 rounded-lg border border-violet/40 bg-violet/5 px-4 py-4">
      <PenLine className="mt-0.5 size-5 shrink-0 text-violet-2" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm text-ink">Falta a renda do mês.</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">Com a renda lançada, cada fatia ganha o seu plano e a folga. Toque numa frase para levar ao agente.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent(FILL_EVENT, { detail: phrase }))}
              className="press min-h-10 rounded-md border border-line px-3 text-left text-xs text-ink hover:border-violet-2"
            >
              {phrase}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, cents, tone }: { label: string; cents: number; tone: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 py-2.5 @lg:block @lg:px-5 @lg:py-3 @lg:first:pl-0">
      <dt className="col-label uppercase">{label}</dt>
      <dd className={`num text-lg [overflow-wrap:anywhere] @lg:mt-1 @lg:text-xl @2xl:text-2xl @4xl:text-3xl ${tone}`}>
        <Rolling cents={cents} />
      </dd>
    </div>
  );
}

function Bar({ ratio, target, color, delay, markerLabel }: { ratio: number; target: number; color: string; delay: number; markerLabel?: string }) {
  if (markerLabel) {
    const at = Math.min(1, Math.max(0, target)) * 100;
    return (
      <div className="relative mb-6">
        <div className="h-2.5 overflow-hidden rounded-full bg-canvas ring-1 ring-line ring-inset">
          <GrowBar className="h-full rounded-full" scale={ratio} delay={delay} style={{ background: color }} />
        </div>
        <span className="pointer-events-none absolute top-[-3px] h-4 w-0.5 -translate-x-1/2 rounded-full bg-ink" style={{ left: `${at}%` }} aria-hidden="true" />
        <span
          className={`col-label pointer-events-none absolute top-full mt-1.5 whitespace-nowrap ${at > 80 ? "-translate-x-full" : at < 20 ? "-translate-x-1/4" : "-translate-x-1/2"}`}
          style={{ left: `${at}%` }}
          aria-hidden="true"
        >
          {markerLabel}
        </span>
      </div>
    );
  }
  return (
    <div className="relative h-1.5 rounded-full bg-canvas">
      <GrowBar className="h-1.5 rounded-full" scale={ratio} delay={delay} style={{ background: color }} />
      <span className="pointer-events-none absolute top-[-3px] h-3 w-px bg-ink" style={{ left: `${Math.min(100, target * 100)}%` }} aria-hidden="true" />
    </div>
  );
}

// Usada também na landing, fora da planilha: uma fatia com barra fina e a marca do plano.
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
  const ratio = income > 0 ? actual / income : 0;
  return (
    <div className="@container min-w-0">
      <div className="mb-1.5 flex min-w-0 flex-col gap-0.5 text-sm @[26rem]:flex-row @[26rem]:items-baseline @[26rem]:justify-between @[26rem]:gap-x-3">
        <span className="flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
          {label}
        </span>
        <span className="num text-muted">
          {formatBRL(actual)}, {Math.round(ratio * 100)}%{suffix}
        </span>
      </div>
      <Bar ratio={ratio} target={target} color={color} delay={delay} />
      {children}
    </div>
  );
}

function Fact({ label, cents, tone }: { label: string; cents: number; tone?: string }) {
  return (
    <div className="min-w-0 px-3 py-2 first:pl-0 @lg:px-4">
      <dt className="col-label uppercase">{label}</dt>
      <dd className={`num mt-0.5 text-sm [overflow-wrap:anywhere] ${tone ?? "text-ink"}`}>
        <Rolling cents={cents} />
      </dd>
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
            <input className={`${fieldClass} num`} inputMode="decimal" placeholder="85,00" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Field>
          <div>
            <label htmlFor="entry-category" className="mb-1.5 block text-sm text-muted">
              Categoria
            </label>
            {categories.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {categories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={category === item}
                    className={`press inline-flex min-h-10 items-center rounded-md border px-3 text-xs ${category === item ? "border-violet-2 text-ink" : "border-line text-muted hover:text-ink"}`}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
            <input id="entry-category" className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value)} />
          </div>
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
        {error ? <FormError>{error}</FormError> : null}
        <div className="flex justify-end">
          <Button type="submit">Lançar</Button>
        </div>
      </form>
    </Modal>
  );
}
