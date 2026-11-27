"use client";

import { Moon, Sun } from "lucide-react";
import { setThemePref, useThemePref, type ThemePref } from "@/lib/theme";

const options: { id: ThemePref; label: string }[] = [
  { id: "dark", label: "Escuro" },
  { id: "light", label: "Claro" },
  { id: "system", label: "Sistema" },
];

// Três opções lado a lado, para o Perfil.
export function ThemeToggle() {
  const pref = useThemePref();
  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-0.5 rounded-md bg-canvas p-0.5">
      {options.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={pref === item.id}
          onClick={() => setThemePref(item.id)}
          className={`press min-h-10 rounded-[5px] px-3 text-sm ${pref === item.id ? "bg-surface-2 text-ink ring-1 ring-violet ring-inset" : "text-muted hover:text-ink"}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// Botão pequeno do app: alterna entre escuro e claro. O "Sistema" fica no Perfil.
export function ThemeButton({ className = "" }: { className?: string }) {
  const pref = useThemePref();
  const showLight = pref === "light";
  const Icon = showLight ? Moon : Sun;
  return (
    <button
      type="button"
      onClick={() => setThemePref(showLight ? "dark" : "light")}
      aria-label={showLight ? "Mudar para o tema escuro" : "Mudar para o tema claro"}
      title={showLight ? "Tema escuro" : "Tema claro"}
      className={`press inline-flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-ink ${className}`}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}
