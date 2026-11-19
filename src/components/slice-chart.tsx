"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { formatBRL } from "@/lib/money";
import { easeOut } from "@/lib/motion";
import { SLICE_COLOR } from "@/lib/sheets";

const slices = [
  { key: "essenciais", label: "Essenciais", color: SLICE_COLOR.essenciais },
  { key: "estilo", label: "Estilo de vida", color: SLICE_COLOR.estilo },
  { key: "futuro", label: "Futuro", color: SLICE_COLOR.futuro },
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
  const reduce = useReducedMotion();
  const values = { essenciais, estilo, futuro };
  const spent = essenciais + estilo;
  const total = spent + futuro;
  const [active, setActive] = useState<(typeof slices)[number]["key"] | null>(null);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const arcs = slices.map((slice, index) => {
    const length = total <= 0 ? 0 : (values[slice.key] / total) * circumference;
    const offset = slices.slice(0, index).reduce((sum, item) => sum + (total <= 0 ? 0 : (values[item.key] / total) * circumference), 0);
    return { ...slice, length, offset, index };
  });

  return (
    <figure className="@container min-w-0 rounded-2xl border border-line bg-surface p-4">
      <figcaption className="kicker">Fatias do que saiu</figcaption>
      {total <= 0 ? (
        <p className="mt-4 text-sm text-muted">Quando houver gasto ou aporte, cada fatia aparece aqui.</p>
      ) : (
        <div className="mt-4 flex min-w-0 flex-col items-center gap-4 @sm:flex-row">
          <svg viewBox="0 0 120 120" className="size-40 shrink-0 overflow-visible" role="img" aria-label="Gráfico das fatias essenciais, estilo de vida e futuro">
            <g transform="rotate(-90 60 60)">
              {arcs.map((slice) => {
                const selected = active === null || active === slice.key;
                const from = -(slice.offset + slice.length);
                const to = -slice.offset;
                return (
                  <motion.circle
                    key={slice.key}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={active === slice.key ? 16 : 12}
                    strokeDasharray={`${slice.length} ${circumference - slice.length}`}
                    initial={reduce ? false : { strokeDashoffset: from, opacity: 0.4 }}
                    animate={{ strokeDashoffset: to, opacity: selected ? 1 : 0.35 }}
                    transition={{ duration: reduce ? 0 : 0.55, delay: reduce ? 0 : slice.index * 0.07, ease: easeOut }}
                    style={{ willChange: "opacity" }}
                  />
                );
              })}
            </g>
            <text x="60" y="57" textAnchor="middle" fill="#f6f3fb" fontSize="10" fontFamily="var(--font-plex), monospace">
              {active ? formatBRL(values[active]) : formatBRL(spent)}
            </text>
            <text x="60" y="71" textAnchor="middle" fill="#b7aec6" fontSize="9">
              {active ? slices.find((slice) => slice.key === active)?.label : futuro > 0 ? "saídas" : "no total"}
            </text>
          </svg>
          <ul className="w-full min-w-0 space-y-2">
            {slices.map((slice) => {
              const share = Math.round((values[slice.key] / total) * 100);
              return (
                <li key={slice.key}>
                  <button
                    type="button"
                    onClick={() => setActive((current) => (current === slice.key ? null : slice.key))}
                    aria-pressed={active === slice.key}
                    className="tint flex min-h-9 w-full min-w-0 flex-wrap items-center justify-between gap-x-3 rounded-xl px-2 py-1.5 text-left hover:bg-canvas"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: slice.color }} aria-hidden="true" />
                      {slice.label}
                    </span>
                    <span className="num text-xs text-muted">
                      {share}%, {formatBRL(values[slice.key])}
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
