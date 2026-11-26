"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

const easeOut = [0.23, 1, 0.32, 1] as const;

export function Modal({
  open,
  title,
  onClose,
  wide = false,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const transition = { duration: reduce ? 0 : 0.2, ease: easeOut };
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
    };
    window.addEventListener("keydown", onKey);
    // O foco entra no diálogo, a menos que um campo dentro dele já o tenha pedido, e volta ao fechar.
    const timer = setTimeout(() => {
      if (panel.current && !panel.current.contains(document.activeElement)) panel.current.focus();
    }, 30);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="dialog"
          className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1, pointerEvents: "auto" }}
          exit={{ opacity: 0, pointerEvents: "none" }}
          transition={transition}
        >
          <button type="button" className="absolute inset-0 bg-black/70" aria-label="Fechar" onClick={onClose} />
          <motion.div
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className={`relative z-10 max-h-[min(92dvh,860px)] w-full overflow-y-auto overscroll-contain rounded-lg border border-line bg-surface p-5 outline-none ${wide ? "max-w-xl" : "max-w-lg"}`}
            initial={reduce ? false : { y: 12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={reduce ? { y: 0 } : { y: 6, scale: 0.99, transition: { duration: 0.15, ease: easeOut } }}
            transition={transition}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 id="modal-title" className="display text-2xl">
                {title}
              </h2>
              <button type="button" onClick={onClose} className="tint inline-flex min-h-10 shrink-0 items-center rounded-md px-3 text-sm text-muted hover:text-ink">
                Fechar
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

const tones = {
  violet: "bg-violet text-ink hover:bg-[#5d3de0]",
  paper: "bg-ink text-canvas hover:bg-white",
  ghost: "border border-line bg-transparent text-ink hover:border-violet-2 hover:bg-surface-2",
} as const;

export function Button({
  tone = "violet",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof tones }) {
  return (
    <button
      {...props}
      className={`press inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${className}`}
    />
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm text-muted">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

// Campo: borda mais firme que a linha comum para passar 3:1 contra o fundo, e o anel de foco global fica ligado.
export const fieldClass =
  "min-h-11 w-full rounded-md border border-field bg-canvas px-3 text-ink focus-visible:border-violet-2 focus-visible:outline-offset-0";

export const cardClass = "rounded-lg border border-line bg-surface p-4";

// Link de texto com alvo de toque de 40px, para listas e rodapés.
export const textLink = "inline-flex min-h-10 items-center text-sm text-violet-2 hover:text-ink";
