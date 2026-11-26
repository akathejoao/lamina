"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function Installer() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}

export function InstallButton() {
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as PromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <div>
      <Button
        type="button"
        onClick={async () => {
          if (!prompt) {
            setMessage("No Chrome ou no Edge, abra o menu e escolha Instalar Lâmina. O app abre numa janela, sem a barra do site.");
            return;
          }
          await prompt.prompt();
          const choice = await prompt.userChoice;
          setMessage(choice.outcome === "accepted" ? "Instalado. Procure Lâmina no menu Iniciar." : "Instalação cancelada.");
          setPrompt(null);
        }}
      >
        Instalar no Windows
      </Button>
      {message ? (
        <p className="mt-4 max-w-md border-l-2 border-line pl-3 text-sm leading-relaxed text-muted" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
