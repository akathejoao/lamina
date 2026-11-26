"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { tips } from "@/lib/finance";
import { easeOut } from "@/lib/motion";
import { useStore } from "@/lib/store";
import { Button, fieldClass } from "./ui";

// Os quatro primeiros ficam à vista. Os outros abrem em "Mais exemplos". Tocar preenche o campo, não envia.
const prompts = [
  "vale alimentação de 350 reais",
  "quanto gastei esse mês?",
  "qual meu saldo?",
  "Gastei R$ 85 no mercado",
  "Meu salário é R$ 5.400",
  "maior gasto",
  "quanto falta pra meta?",
  "desfaz",
];
const VISIBLE_PROMPTS = 4;
const tabs = [
  { id: "agente", label: "Agente" },
  { id: "dicas", label: "Dicas" },
] as const;

export function AgentPanel({ sheetId, compact = false }: { sheetId: string; compact?: boolean }) {
  const { state, send } = useStore();
  const reduce = useReducedMotion();
  const [text, setText] = useState("");
  const [tab, setTab] = useState<"agente" | "dicas">("agente");
  const [moreExamples, setMoreExamples] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const sheet = state.sheets.find((item) => item.id === sheetId);
  const messages = state.messages.filter((message) => message.sheetId === sheetId);
  const advice = useMemo(() => (sheet ? tips(state, sheet) : []), [sheet, state]);
  const inputId = `chat-${sheetId}${compact ? "-c" : ""}`;

  // A conversa sempre abre na última mensagem, e cada resposta nova pula até ela, sem rolagem animada.
  useEffect(() => {
    const box = list.current;
    if (!box) return;
    box.scrollTop = box.scrollHeight;
  }, [messages.length, tab]);

  if (!sheet) return null;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const value = text.trim();
    if (!value) return;
    send(sheetId, value);
    setText("");
    setTab("agente");
  };

  return (
    <aside className="relative flex h-full min-h-0 flex-1 flex-col bg-canvas-2" aria-label="Agente">
      <div className="shrink-0 border-b border-line p-3">
        <div className="relative grid grid-cols-2 rounded-md bg-canvas p-0.5" role="tablist" aria-label="Agente e dicas">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-[5px] border-b-2 border-violet bg-surface-2 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[var(--ease-out)]"
            style={{ transform: tab === "agente" ? "translateX(0)" : "translateX(100%)" }}
          />
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`tint relative min-h-10 rounded-md px-4 text-sm ${tab === item.id ? "text-ink" : "text-muted hover:text-ink"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "agente" ? (
        <>
          <div
            ref={list}
            className={`relative min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 ${compact ? "max-h-72 lg:max-h-none" : ""}`}
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.length === 0 ? (
              <p className="sheet-grid rounded-lg border border-line px-3 py-3 text-sm leading-relaxed text-muted">
                Estou na planilha {sheet.name}. Escreva um gasto ou uma entrada, ou pergunte algo como “quanto gastei esse mês?”. Os exemplos abaixo preenchem o campo.
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.p
                    key={message.id}
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: reduce ? 0 : 0.12, ease: easeOut }}
                    className={`text-sm leading-relaxed whitespace-pre-line [overflow-wrap:anywhere] ${
                      message.role === "user"
                        ? "ml-auto w-fit max-w-[88%] rounded-lg bg-surface-2 px-3 py-2 text-ink"
                        : "max-w-[95%] border-l border-violet-2/40 py-0.5 pl-3 text-ink"
                    }`}
                  >
                    <span className="sr-only">{message.role === "user" ? "Você: " : "Agente: "}</span>
                    {message.text}
                  </motion.p>
                ))}
              </AnimatePresence>
            )}
          </div>
          <div className="flex max-h-24 shrink-0 flex-wrap gap-1.5 overflow-y-auto border-t border-line px-3 pt-2 pb-2">
            {(moreExamples ? prompts : prompts.slice(0, VISIBLE_PROMPTS)).map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  setText(prompt);
                  input.current?.focus();
                }}
                className="tint min-h-10 rounded-md border border-line px-3 text-left text-xs text-muted hover:border-violet-2 hover:text-ink"
              >
                {prompt}
              </button>
            ))}
            <button
              type="button"
              aria-expanded={moreExamples}
              onClick={() => setMoreExamples((value) => !value)}
              className="tint min-h-10 rounded-md px-3 text-xs text-violet-2 hover:text-ink"
            >
              {moreExamples ? "Menos exemplos" : "Mais exemplos"}
            </button>
          </div>
          <form onSubmit={submit} className="flex shrink-0 gap-2 border-t border-line p-3">
            <label className="sr-only" htmlFor={inputId}>
              Mensagem para o agente
            </label>
            <input
              ref={input}
              id={inputId}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Gastei 85 no mercado"
              className={fieldClass}
            />
            <Button type="submit">Enviar</Button>
          </form>
        </>
      ) : (
        <ul className="ruled min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-1">
          {advice.length === 0 ? (
            <li className="sheet-grid my-3 rounded-lg border border-line px-3 py-3 text-sm text-muted">Sem dica por enquanto. Elas aparecem quando há gastos lançados.</li>
          ) : null}
          {advice.map((tip, index) => (
            <li key={tip} className="flex gap-3 py-3 text-sm leading-relaxed text-ink">
              <span className="num mt-0.5 shrink-0 text-xs text-faint">{String(index + 1).padStart(2, "0")}</span>
              <span className="min-w-0">{tip}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
