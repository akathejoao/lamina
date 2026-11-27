"use client";

import { FormEvent, useState } from "react";
import { parseMoney } from "@/lib/money";
import {
  ACCENT_COLOR,
  ACCENT_LABEL,
  nextBucket,
  SLICE_COLOR,
  SLICE_LABEL,
  TEMPLATES,
  type SheetDraft,
} from "@/lib/sheets";
import { KIND_LABEL, type SheetAccent, type SheetCategory, type SheetKind, type SheetSplit, type SliceKey } from "@/lib/types";
import { Button, Field, fieldClass } from "./ui";
import { FormError } from "./motion-bits";

const kinds: SheetKind[] = ["mensal", "meta", "continuo"];
const accents: SheetAccent[] = ["violeta", "menta", "coral", "ambar"];
const slices: SliceKey[] = ["essenciais", "estilo", "futuro"];

export function SheetForm({
  mode,
  defaultMonth,
  initial,
  onSubmit,
}: {
  mode: "create" | "edit";
  defaultMonth: string;
  initial?: SheetDraft;
  onSubmit: (draft: SheetDraft) => void;
}) {
  const starter = TEMPLATES[0];
  const [templateId, setTemplateId] = useState(starter.id);
  const [nameTouched, setNameTouched] = useState(mode === "edit");
  const [name, setName] = useState(initial?.name ?? starter.name);
  const [kind, setKind] = useState<SheetKind>(initial?.kind ?? starter.kind);
  const [month, setMonth] = useState(initial?.month ?? defaultMonth);
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [target, setTarget] = useState(initial?.targetCents ? String(initial.targetCents / 100) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [accent, setAccent] = useState<SheetAccent>(initial?.accent ?? starter.accent);
  const [categories, setCategories] = useState<SheetCategory[]>(initial?.categories ?? starter.categories.map((item) => ({ ...item })));
  const [split, setSplit] = useState<SheetSplit>(initial?.split ?? { ...starter.split });
  const [draftCategory, setDraftCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sum = split.essenciais + split.estilo + split.futuro;

  const applyTemplate = (id: string) => {
    const template = TEMPLATES.find((item) => item.id === id);
    if (!template) return;
    setTemplateId(template.id);
    if (!nameTouched) setName(template.id === "branco" ? "" : template.name);
    setKind(template.kind);
    setAccent(template.accent);
    setCategories(template.categories.map((item) => ({ ...item })));
    setSplit({ ...template.split });
  };

  const addCategory = () => {
    const label = draftCategory.trim().replace(/\s+/g, " ");
    if (label.length < 2) {
      setError("A categoria precisa de pelo menos duas letras.");
      return;
    }
    if (categories.some((item) => item.name.toLocaleLowerCase("pt-BR") === label.toLocaleLowerCase("pt-BR"))) {
      setError("Essa categoria já está na planilha.");
      return;
    }
    if (categories.length >= 12) {
      setError("Doze categorias cabem. Tire uma antes de criar outra.");
      return;
    }
    setCategories((current) => [...current, { name: label, bucket: "estilo" }]);
    setDraftCategory("");
    setError(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError("Dê um nome que você reconheça daqui a um mês.");
      return;
    }
    if (sum !== 100) {
      setError("As três fatias precisam somar 100.");
      return;
    }
    const targetCents = target.trim() ? parseMoney(target) : null;
    if (target.trim() && targetCents === null) {
      setError("O valor da meta não ficou claro. Use algo como 1800 ou 1.800,00.");
      return;
    }
    onSubmit({
      name: name.trim(),
      kind,
      month,
      deadline: deadline || null,
      targetCents,
      note: note.trim(),
      accent,
      categories,
      split,
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      {mode === "create" ? (
        <fieldset>
          <legend className="mb-2 text-sm text-muted">Começar de um modelo</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                aria-pressed={templateId === template.id}
                onClick={() => applyTemplate(template.id)}
                className={`tint rounded-lg border px-3 py-3 text-left ${templateId === template.id ? "border-violet-2 bg-canvas" : "border-line hover:border-violet-2"}`}
              >
                <span className="block text-sm text-ink">{template.name}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">{template.blurb}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <Field label="Nome">
        <input
          className={fieldClass}
          value={name}
          maxLength={60}
          placeholder="Novembro, Japão, Reserva"
          onChange={(event) => {
            setNameTouched(true);
            setName(event.target.value);
          }}
        />
      </Field>
      <Field label="Tipo">
        <select className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value as SheetKind)}>
          {kinds.map((item) => (
            <option key={item} value={item}>
              {KIND_LABEL[item]}
            </option>
          ))}
        </select>
      </Field>
      {kind === "mensal" ? (
        <Field label="Mês">
          <input className={fieldClass} type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </Field>
      ) : null}
      {kind === "meta" ? (
        <Field label="Prazo">
          <input className={fieldClass} type="date" value={deadline ?? ""} onChange={(event) => setDeadline(event.target.value)} />
        </Field>
      ) : null}
      {kind !== "mensal" ? (
        <Field label="Valor da meta">
          <input className={fieldClass} inputMode="decimal" value={target} placeholder="1800" onChange={(event) => setTarget(event.target.value)} />
        </Field>
      ) : null}
      <Field label="Para que ela serve">
        <input className={fieldClass} value={note} maxLength={80} placeholder="Viagem de julho, ou o mês da casa" onChange={(event) => setNote(event.target.value)} />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm text-muted">Cor</legend>
        <div className="flex gap-2">
          {accents.map((item) => (
            <button
              key={item}
              type="button"
              aria-label={ACCENT_LABEL[item]}
              aria-pressed={accent === item}
              onClick={() => setAccent(item)}
              className={`size-10 rounded-full ${accent === item ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`}
              style={{ background: ACCENT_COLOR[item] }}
            />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm text-muted">Categorias</legend>
        <p className="mt-1 text-xs leading-relaxed text-muted">Toque numa categoria para mudar a fatia. A cor mostra se ela conta como essencial, estilo ou futuro.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {categories.map((item) => (
            <li key={item.name} className="flex items-center rounded-md border border-line bg-canvas pl-3">
              <button
                type="button"
                className="inline-flex min-h-10 items-center gap-1.5 text-xs"
                aria-label={`${item.name}, fatia ${SLICE_LABEL[item.bucket]}. Trocar a fatia.`}
                onClick={() =>
                  setCategories((current) =>
                    current.map((category) => (category.name === item.name ? { ...category, bucket: nextBucket(category.bucket) } : category)),
                  )
                }
              >
                <span className="size-2 rounded-full" style={{ background: SLICE_COLOR[item.bucket] }} />
                {item.name}
              </button>
              <button
                type="button"
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-sm text-muted hover:text-coral"
                aria-label={`Tirar ${item.name}`}
                onClick={() => setCategories((current) => current.filter((category) => category.name !== item.name))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            className={fieldClass}
            value={draftCategory}
            maxLength={24}
            placeholder="Nova categoria"
            onChange={(event) => setDraftCategory(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCategory();
              }
            }}
          />
          <Button type="button" tone="ghost" onClick={addCategory}>
            Adicionar
          </Button>
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm text-muted">Divisão que você quer seguir</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {slices.map((slice) => (
            <label key={slice} className="text-xs text-muted">
              {SLICE_LABEL[slice]}
              <input
                className={`${fieldClass} mt-1`}
                inputMode="numeric"
                min={0}
                max={100}
                value={split[slice]}
                aria-label={`Percentual de ${SLICE_LABEL[slice]}`}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  const value = Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : 0;
                  setSplit((current) => ({ ...current, [slice]: value }));
                }}
              />
            </label>
          ))}
        </div>
        <p className={`mt-2 text-xs ${sum === 100 ? "text-mint" : "text-coral"}`}>Soma {sum}. As três partes fecham em 100.</p>
      </fieldset>
      {error ? (
        <FormError>{error}</FormError>
      ) : null}
      <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end border-t border-line bg-surface px-5 py-3">
        <Button type="submit">{mode === "create" ? "Criar planilha" : "Salvar"}</Button>
      </div>
    </form>
  );
}
