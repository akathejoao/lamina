"use client";

import { useState } from "react";
import { trails } from "@/lib/learn";
export function LearnView() {
  const [open, setOpen] = useState(trails[0].id);
  const current = trails.find((trail) => trail.id === open) ?? trails[0];

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-[240px_1fr] sm:px-8">
        <div>
          <p className="kicker">Trilhas</p>
          <h1 className="display mt-3 text-4xl">Pílulas curtas</h1>
          <ul className="mt-6 space-y-2">
            {trails.map((trail) => (
              <li key={trail.id}>
                <button
                  type="button"
                  onClick={() => setOpen(trail.id)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm ${open === trail.id ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface"}`}
                >
                  {trail.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <article>
          <h2 className="display text-3xl">{current.title}</h2>
          <ol className="mt-6 space-y-4">
            {current.pills.map((pill, index) => (
              <li key={pill.title} className="rounded-2xl border border-line bg-surface p-4">
                <p className="kicker">0{index + 1}</p>
                <h3 className="mt-2 text-xl">{pill.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{pill.body}</p>
              </li>
            ))}
          </ol>
        </article>
      </div>
  );
}
