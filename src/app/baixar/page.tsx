import Link from "next/link";
import { InstallButton, Installer } from "@/components/install";
import { Mark } from "@/components/mark";

export default function DownloadPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-10">
      <Installer />
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted">
        <Mark className="size-7" />
        Voltar
      </Link>
      <p className="kicker mt-10">Windows e PWA</p>
      <h1 className="display mt-4 text-5xl md:text-6xl">A mesma planilha, numa janela só.</h1>
      <p className="mt-5 max-w-xl text-muted">
        Não há um instalador separado para baixar. No Windows, o Chrome e o Edge instalam a Lâmina como aplicativo: ícone no menu Iniciar, janela própria, os dados continuam neste computador.
      </p>
      <div className="mt-8">
        <InstallButton />
      </div>
      <ol className="mt-10 space-y-3 text-sm leading-relaxed text-muted">
        <li>1. Abra esta página no Chrome ou no Edge.</li>
        <li>2. Use Instalar no Windows, ou o ícone de instalação na barra de endereço.</li>
        <li>3. A planilha e o agente abrem sem a moldura do site.</li>
      </ol>
      <Link href="/app" className="mt-8 inline-flex min-h-11 items-center text-sm text-violet-2">
        Prefere o navegador? Abrir o app
      </Link>
    </main>
  );
}
