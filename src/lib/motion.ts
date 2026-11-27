// O estado vazio da planilha pede ao agente que preencha o campo de texto com uma frase de exemplo.
export const FILL_EVENT = "lamina:fill";

export const easeOut = [0.23, 1, 0.32, 1] as const;

export const rise = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: easeOut },
} as const;

export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.2, ease: easeOut },
} as const;

export const listParent = {
  initial: "hidden",
  animate: "show",
  variants: {
    hidden: {},
    show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
  },
} as const;

export const listItem = {
  variants: {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: easeOut } },
  },
} as const;
