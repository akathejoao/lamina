"use client";

import { FormEvent, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { tips } from "@/lib/finance";
import { easeOut } from "@/lib/motion";
import { useStore } from "@/lib/store";
import { Button, fieldClass } from "./ui";

const prompts = [
  "Gastei R$ 85 no mercado hoje",
  "Quanto posso gastar por dia até o fim do mês?",
  "Simule se eu guardar R$ 400 todo mês",
];

export function AgentPanel({ sheetId, compact = false }: { sheetId: string; compact?: boolean }) {
  const { state, send } = useStore();
  const reduce = useReducedMotion();
  const [text, setText] = useState("");
  const [tab, setTab] = useState<"agente" | "dicas">("agente");
  const sheet = state.sheets.find((item) => item.id === sheetId);
  const messages = state.messages.filter((message) => message.sheetId === sheetId);
  const advice = useMemo(() => (sheet ? tips(state, sheet) : []), [sheet, state]);

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
    <aside className={`flex min-h-0 flex-col border-line bg-canvas-2 ${compact ? "h-full" : "h-full"}`}>
      <div className="flex items-center gap-2 border-b border-line px-3 py-3">
        <button
          type="button"
          onClick={() => setTab("agente")}
          className={`rounded-full px-3 py-1.5 text-sm ${tab === "agente" ? "bg-violet text-ink" : "text-muted"}`}
        >
          Agente
        </button>
        <button
          type="button"
          onClick={() => setTab("dicas")}
          className={`rounded-full px-3 py-1.5 text-sm ${tab === "dicas" ? "bg-violet text-ink" : "text-muted"}`}
        >
          Dicas
        </button>
      </div>
      {tab === "agente" ? (
        <>
          <div className={`flex-1 space-y-3 overflow-y-auto px-3 py-3 ${compact ? "max-h-72" : "min-h-48"}`}>
            {messages.length === 0 ? (
              <p className="text-sm leading-relaxed text-muted">
                Estou na planilha {sheet.name}. Manda um gasto do jeito que você falaria: “Gastei R$ 85 no mercado hoje”.
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
                    {message.text}
                  </motion.p>
                ))}
              </AnimatePresence>
            )}
          </div>
          <div className="flex flex-wrap gap-2 px-3 pb-2">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  send(sheetId, prompt);
                  setTab("agente");
                }}
                className="rounded-full border border-line px-2.5 py-1 text-left text-xs text-muted hover:border-violet-2 hover:text-ink"
              >
                {prompt}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
            <label className="sr-only" htmlFor={`chat-${sheetId}${compact ? "-c" : ""}`}>
              Mensagem para o agente
            </label>
            <input
              id={`chat-${sheetId}${compact ? "-c" : ""}`}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Gastei R$ 85 no mercado hoje"
              className={fieldClass}
            />
            <Button type="submit">Enviar</Button>
          </form>
        </>
      ) : (
        <ul className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
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
