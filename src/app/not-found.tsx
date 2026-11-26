import Link from "next/link";
import { Mark } from "@/components/mark";

export default function NotFound() {
  return (
    <main className="relative flex h-dvh flex-col justify-center overflow-hidden px-4">
      <div className="sheet-grid sheet-grid-fade pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto w-full max-w-2xl">
        <Link href="/" className="display inline-flex min-h-10 items-center gap-2 text-xl">
          <Mark className="size-7" />
          Lâmina
        </Link>
        <p className="col-label mt-8">ERRO 404 · LINHA NÃO ENCONTRADA</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Essa linha não existe nesta planilha.</h1>
        <p className="mt-5 max-w-md text-muted">O endereço pode ter mudado ou nunca ter existido. A página inicial tem o caminho de volta.</p>
        <Link href="/" className="press mt-8 inline-flex min-h-11 items-center justify-center rounded-md bg-violet px-5 text-sm font-medium text-ink hover:bg-[#5d3de0]">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
