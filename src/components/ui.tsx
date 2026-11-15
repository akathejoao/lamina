"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, type ReactNode } from "react";

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
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className={`relative z-10 max-h-[min(92dvh,860px)] w-full overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-2xl ${wide ? "max-w-xl" : "max-w-lg"}`}
            initial={reduce ? false : { y: 12 }}
            animate={{ y: 0 }}
            exit={reduce ? { y: 0 } : { y: 8 }}
            transition={transition}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 id="modal-title" className="display text-2xl">
                {title}
              </h2>
              <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-sm text-muted">
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
  violet: "bg-violet text-ink hover:bg-[#6d4df2]",
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
      className={`press inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${className}`}
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

export const fieldClass =
  "min-h-11 w-full rounded-xl border border-line bg-canvas px-3 text-ink outline-none focus-visible:border-violet";
