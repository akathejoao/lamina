"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button, Modal } from "./ui";

export function ResetView() {
  const { state, reset, scope } = useStore();
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
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="display text-4xl sm:text-5xl">Começar as finanças de novo</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {scope === "conta"
          ? "Isso apaga planilhas, lançamentos, metas e conversas do agente nesta conta. O nome, o e-mail e a senha ficam. A planilha nova nasce cifrada do zero."
          : "Na demonstração, isso devolve o exemplo da Marina. Se quiser só limpar uma planilha, use Limpar dentro dela."}
      </p>

      <dl className="mt-6 grid grid-cols-3 divide-x divide-line border-y border-line">
        <Count label="Planilhas abertas" value={String(sheets)} />
        <Count label="Lançamentos" value={String(entries)} />
        <Count label="Metas" value={String(goals)} />
      </dl>

      {done ? (
        <div className="blade mt-6 rounded-lg border border-line bg-surface p-4" role="status">
          <p className="text-lg text-mint">Pronto. A planilha voltou limpa.</p>
          <p className="mt-2 text-sm text-muted">
            {scope === "conta"
              ? "Você tem um ciclo do mês atual, sem lançamentos. O agente começa em branco."
              : "O novembro da Marina voltou, com os números do exemplo."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/app" className="press inline-flex min-h-11 items-center justify-center rounded-md bg-violet px-4 text-sm font-medium text-ink hover:bg-[#5d3de0]">
              Ver planilhas
            </Link>
            <Button type="button" tone="ghost" onClick={() => setDone(false)}>
              Fechar aviso
            </Button>
          </div>
        </div>
      ) : (
        <div className="blade mt-6 rounded-lg border border-line bg-surface p-4">
          <p className="text-sm leading-relaxed text-muted">
            {scope === "conta"
              ? "Não dá para desfazer. Se quiser guardar algo, exporte em Perfil antes."
              : "Você pode restaurar o exemplo quantas vezes quiser nesta demonstração."}
          </p>
          <div className="mt-4">
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

function Count({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 py-3 first:pl-0 sm:px-5 sm:first:pl-0">
      <dt className="col-label uppercase">{label}</dt>
      <dd className="num mt-1 text-2xl">{value}</dd>
    </div>
  );
}
