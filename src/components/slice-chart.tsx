"use client";

import { useState } from "react";
import { formatBRL } from "@/lib/money";

const slices = [
  { key: "essenciais", label: "Essenciais", color: "#7c5cff" },
  { key: "estilo", label: "Estilo de vida", color: "#ff8aa0" },
  { key: "futuro", label: "Futuro", color: "#b6ffd2" },
] as const;

export function SliceChart({
  essenciais,
  estilo,
  futuro,
}: {
  essenciais: number;
  estilo: number;
  futuro: number;
}) {
  const values = { essenciais, estilo, futuro };
  const total = essenciais + estilo + futuro;
  const [active, setActive] = useState<(typeof slices)[number]["key"] | null>(null);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const arcs = slices.map((slice, index) => {
    const length = total <= 0 ? 0 : (values[slice.key] / total) * circumference;
    const offset = slices.slice(0, index).reduce((sum, item) => sum + (total <= 0 ? 0 : (values[item.key] / total) * circumference), 0);
    return { ...slice, length, offset };
  });

  return (
    <figure className="rounded-2xl border border-line bg-surface p-4">
      <figcaption className="kicker">Fatias do que saiu</figcaption>
      {total <= 0 ? (
        <p className="mt-4 text-sm text-muted">Quando houver gasto ou aporte, cada fatia aparece aqui.</p>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
          <svg viewBox="0 0 120 120" className="size-36 shrink-0" role="img" aria-label="Gráfico das fatias essenciais, estilo de vida e futuro">
            <g transform="rotate(-90 60 60)">
              {arcs.map((slice) => {
                const dash = `${slice.length} ${circumference - slice.length}`;
                const selected = active === null || active === slice.key;
                return (
                  <circle
                    key={slice.key}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={active === slice.key ? 16 : 12}
                    strokeDasharray={dash}
                    strokeDashoffset={-slice.offset}
                    opacity={selected ? 1 : 0.35}
                  />
                );
              })}
            </g>
            <text x="60" y="58" textAnchor="middle" fill="#f6f3fb" fontSize="9" fontFamily="var(--font-plex), monospace">
              {active ? `${Math.round((values[active] / total) * 100)}%` : formatBRL(total)}
            </text>
            <text x="60" y="72" textAnchor="middle" fill="#b7aec6" fontSize="7">
              {active ? slices.find((slice) => slice.key === active)?.label : "no total"}
            </text>
          </svg>
          <ul className="w-full space-y-2">
            {slices.map((slice) => {
              const share = Math.round((values[slice.key] / total) * 100);
              return (
                <li key={slice.key}>
                  <button
                    type="button"
                    onClick={() => setActive((current) => (current === slice.key ? null : slice.key))}
                    aria-pressed={active === slice.key}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-canvas"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <span className="size-2.5 rounded-full" style={{ background: slice.color }} />
                      {slice.label}
                    </span>
                    <span className="num text-xs text-muted">
                      {share}% · {formatBRL(values[slice.key])}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </figure>
  );
}
