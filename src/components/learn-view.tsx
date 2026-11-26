"use client";

import { useState } from "react";
import { trails } from "@/lib/learn";

const pillCount = trails.reduce((sum, trail) => sum + trail.pills.length, 0);

export function LearnView() {
  const [open, setOpen] = useState(trails[0].id);
  const current = trails.find((trail) => trail.id === open) ?? trails[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="display text-4xl sm:text-5xl">Pílulas curtas</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
        <span className="num">{trails.length}</span> trilhas e <span className="num">{pillCount}</span> pílulas de um minuto, sobre o dinheiro de quem mora no Brasil. Escolha uma trilha e leia na ordem.
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10">
        <nav aria-label="Trilhas" className="min-w-0 md:sticky md:top-0 md:self-start">
          <p className="col-label mb-2 hidden uppercase md:block">Trilhas</p>
          <ul className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:block md:overflow-visible md:border-l md:border-line md:px-0 md:pb-0">
            {trails.map((trail, index) => {
              const selected = open === trail.id;
              return (
                <li key={trail.id} className="shrink-0 snap-start md:shrink">
                  <button
                    type="button"
                    onClick={() => setOpen(trail.id)}
                    aria-current={selected ? "true" : undefined}
                    className={`tint flex min-h-11 w-max max-w-[16rem] items-center gap-3 rounded-md border px-4 text-left text-sm md:w-full md:max-w-none md:-ml-px md:rounded-none md:rounded-r-md md:border-0 md:border-l-2 md:py-2 ${
                      selected
                        ? "border-violet-2 bg-surface-2 text-ink md:border-violet md:bg-surface"
                        : "border-line text-muted hover:border-violet-2 hover:text-ink md:border-transparent md:hover:bg-surface/60"
                    }`}
                  >
                    <span className="num hidden text-xs text-faint md:inline">{String(index + 1).padStart(2, "0")}</span>
                    {trail.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <article className="blade min-w-0 rounded-lg border border-line bg-surface p-4 sm:p-6" aria-labelledby="trilha-titulo">
          <h2 id="trilha-titulo" className="display text-3xl sm:text-4xl">
            {current.title}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{current.summary}</p>
          <ol className="ruled mt-5 border-t border-line">
            {current.pills.map((pill, index) => (
              <li key={pill.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 py-4">
                <span className="num pt-1 text-xs text-faint">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <h3 className="text-xl">{pill.title}</h3>
                  <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted">{pill.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </article>
      </div>
    </div>
  );
}
