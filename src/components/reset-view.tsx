"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { rise } from "@/lib/motion";
import { useStore } from "@/lib/store";
import { Button, Modal } from "./ui";

export function ResetView() {
  const { state, reset, scope } = useStore();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const sheets = state.sheets.filter((sheet) => !sheet.archived).length;
  const entries = state.entries.length;
  const goals = state.goals.length;

  const confirm = () => {
    reset();
    setOpen(false);
    setDone(true);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
      <motion.div {...(reduce ? {} : rise)}>
        <p className="kicker">Resetar</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Começar as finanças de novo</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          {scope === "conta"
            ? "Isso apaga planilhas, lançamentos, metas e conversas do agente nesta conta. O nome, o e-mail e a senha ficam. A planilha nova nasce cifrada do zero."
            : "Na demonstração, isso devolve o exemplo da Marina. Se quiser só limpar uma planilha, use Limpar dentro dela."}
        </p>
      </motion.div>

      <motion.ul
        className="mt-8 grid gap-3 sm:grid-cols-3"
        initial={reduce ? false : "hidden"}
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: reduce ? 0 : 0.06 } },
        }}
      >
        <Count label="Planilhas abertas" value={String(sheets)} reduce={!!reduce} />
        <Count label="Lançamentos" value={String(entries)} reduce={!!reduce} />
        <Count label="Metas" value={String(goals)} reduce={!!reduce} />
      </motion.ul>

      {done ? (
        <motion.div
          className="mt-8 rounded-2xl border border-line bg-surface p-5"
          {...(reduce ? {} : rise)}
        >
          <p className="text-lg text-mint">Pronto. A planilha voltou limpa.</p>
          <p className="mt-2 text-sm text-muted">
            {scope === "conta"
              ? "Você tem um ciclo do mês atual, sem lançamentos. O agente começa em branco."
              : "O novembro da Marina voltou, com os números do exemplo."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/app" className="press inline-flex min-h-11 items-center justify-center rounded-full bg-violet px-4 text-sm font-medium">
              Ver planilhas
            </Link>
            <Button type="button" tone="ghost" onClick={() => setDone(false)}>
              Fechar aviso
            </Button>
          </div>
        </motion.div>
      ) : (
        <div className="mt-8 rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm leading-relaxed text-muted">
            {scope === "conta"
              ? "Não dá para desfazer. Se quiser guardar algo, exporte em Perfil antes."
              : "Você pode restaurar o exemplo quantas vezes quiser nesta demonstração."}
          </p>
          <div className="mt-5">
            <Button type="button" onClick={() => setOpen(true)}>
              {scope === "conta" ? "Zerar minhas finanças" : "Restaurar o exemplo"}
            </Button>
          </div>
        </div>
      )}

      <Modal open={open} title={scope === "conta" ? "Zerar a conta?" : "Restaurar o exemplo?"} onClose={() => setOpen(false)}>
        <p className="text-sm leading-relaxed text-muted">
          {scope === "conta"
            ? `Vão sumir ${entries} lançamentos e ${sheets} planilhas. O perfil e o login continuam.`
            : "A demonstração volta para o novembro da Marina, com os lançamentos de exemplo."}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirm}>
            Confirmar
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Count({ label, value, reduce }: { label: string; value: string; reduce: boolean }) {
  return (
    <motion.li
      className="rounded-2xl border border-line bg-surface px-4 py-3"
      variants={{
        hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 },
      }}
    >
      <p className="kicker">{label}</p>
      <p className="num mt-2 text-2xl">{value}</p>
    </motion.li>
  );
}
