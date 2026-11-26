import Link from "next/link";
import { InstallButton, Installer } from "@/components/install";
import { Mark } from "@/components/mark";

const STEPS = [
  "Abra esta página no Chrome ou no Edge.",
  "Use Instalar no Windows, ou o ícone de instalação na barra de endereço.",
  "A planilha e o agente abrem sem a moldura do site.",
];

export default function DownloadPage() {
  return (
    <div className="relative h-dvh overflow-y-auto overscroll-contain">
      <main className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
        <Installer />
        <Link href="/" className="display inline-flex min-h-10 items-center gap-2 text-xl">
          <Mark className="size-7" />
          Lâmina
        </Link>
        <p className="col-label mt-8">A  WINDOWS · CHROME · EDGE</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">A mesma planilha, numa janela só.</h1>
        <p className="mt-5 max-w-xl leading-relaxed text-muted">
          Não há um instalador separado para baixar. No Windows, o Chrome e o Edge instalam a Lâmina como aplicativo: ícone no menu Iniciar, janela própria, os dados continuam neste computador.
        </p>
        <div className="mt-8 border-t border-line pt-6">
          <InstallButton />
        </div>
        <ol className="ruled mt-10 border-y border-line text-sm leading-relaxed text-muted">
          {STEPS.map((step, index) => (
            <li key={step} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-baseline py-3.5">
              <span className="col-label" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <Link href="/app" className="mt-4 inline-flex min-h-11 items-center text-sm text-violet-2 hover:text-ink">
          Prefere o navegador? Abrir o app
        </Link>
      </main>
    </div>
  );
}
