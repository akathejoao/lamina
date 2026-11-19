"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { tips } from "@/lib/finance";
import { easeOut } from "@/lib/motion";
import { useStore } from "@/lib/store";
import { Button, fieldClass } from "./ui";

const prompts = ["Meu salário é R$ 5.400", "100 reais de uber", "Gastei R$ 85 no mercado"];

export function AgentPanel({ sheetId, compact = false }: { sheetId: string; compact?: boolean }) {
  const { state, send } = useStore();
  const reduce = useReducedMotion();
  const [text, setText] = useState("");
  const [tab, setTab] = useState<"agente" | "dicas">("agente");
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const sheet = state.sheets.find((item) => item.id === sheetId);
  const messages = state.messages.filter((message) => message.sheetId === sheetId);
  const advice = useMemo(() => (sheet ? tips(state, sheet) : []), [sheet, state]);
  const inputId = `chat-${sheetId}${compact ? "-c" : ""}`;

  // A conversa sempre abre na última mensagem, e cada resposta nova rola até ela.
  useEffect(() => {
    const box = list.current;
    if (!box) return;
    box.scrollTo({ top: box.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages.length, tab, reduce]);

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
    <aside className="flex h-full min-h-0 flex-1 flex-col bg-canvas-2" aria-label="Agente">
      <div className="flex items-center gap-2 border-b border-line px-3 py-3" role="tablist" aria-label="Agente e dicas">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "agente"}
          onClick={() => setTab("agente")}
          className={`min-h-9 rounded-full px-3 text-sm ${tab === "agente" ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}
        >
          Agente
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "dicas"}
          onClick={() => setTab("dicas")}
          className={`min-h-9 rounded-full px-3 text-sm ${tab === "dicas" ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}
        >
          Dicas
        </button>
      </div>
      {tab === "agente" ? (
        <>
          <div
            ref={list}
            className={`min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 ${compact ? "max-h-72 lg:max-h-none" : "min-h-48"}`}
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.length === 0 ? (
              <p className="text-sm leading-relaxed text-muted">
                Estou na planilha {sheet.name}. Escreva um gasto ou uma entrada, como nos exemplos abaixo.
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.p
                    key={message.id}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduce ? 0 : 0.2, ease: easeOut }}
                    className={`max-w-[95%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      message.role === "user" ? "ml-auto bg-surface-2 text-ink" : "bg-surface text-ink"
                    }`}
                  >
                    <span className="sr-only">{message.role === "user" ? "Você: " : "Agente: "}</span>
                    {message.text}
                  </motion.p>
                ))}
              </AnimatePresence>
            )}
          </div>
          <div className="flex flex-wrap gap-2 px-3 pt-2 pb-2">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  setText(prompt);
                  input.current?.focus();
                }}
                className="min-h-9 rounded-full border border-line px-3 text-left text-xs text-muted hover:border-violet-2 hover:text-ink"
              >
                {prompt}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
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
        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {advice.length === 0 ? <li className="text-sm text-muted">Sem dica por enquanto. Elas aparecem quando há gastos lançados.</li> : null}
          {advice.map((tip) => (
            <li key={tip} className="rounded-2xl border border-line bg-surface p-3 text-sm leading-relaxed text-ink">
              {tip}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
