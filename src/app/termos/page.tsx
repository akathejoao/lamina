import Link from "next/link";
import { LegalShell } from "@/components/legal-shell";

export default function TermsPage() {
  return (
    <LegalShell kicker="Termos de uso · versão 2026-11-15" title="A Lâmina organiza. Ela não decide por você.">
      <p>
        Estes termos valem para quem cria uma conta na Lâmina. Ao marcar o consentimento no cadastro, você aceita este texto e o aviso de privacidade da mesma data.
      </p>
      <h2>O que o serviço é</h2>
      <p>
        A Lâmina é uma planilha pessoal com um agente que lança e explica números. Não é banco, não é corretora, não é escritório de contabilidade e não oferece crédito, investimento ou consultoria financeira. Nada que o agente escreva substitui uma decisão sua ou de um profissional habilitado.
      </p>
      <h2>A conta</h2>
      <p>
        Você informa nome, e-mail e senha. A senha é sua chave: se esquecer, a planilha cifrada não pode ser recuperada, porque o banco não guarda o texto aberto. A conta é individual e para uso pessoal. Não use a conta de outra pessoa e não tente acessar planilha que não é sua.
      </p>
      <h2>O que você coloca na planilha</h2>
      <p>
        Os lançamentos são seus. Você é responsável por eles serem fiéis ao que quer acompanhar. Não envie dados de terceiros sem uma base para isso, nem use o serviço para guardar segredo de outra pessoa sem o consentimento dela.
      </p>
      <h2>Uso aceitável</h2>
      <p>
        Não tente quebrar o acesso de outras contas, sobrecarregar o serviço de propósito, nem usar a Lâmina para fraude. Podemos pausar ou encerrar uma conta que faça isso, ou quando o acesso contratado acabar. Você pode encerrar a sua quando quiser, em Perfil, com a senha.
      </p>
      <h2>Disponibilidade</h2>
      <p>
        O serviço pode parar para manutenção ou falha. Não há garantia de que a planilha estará disponível o tempo todo, nem de que um número calculado aqui substitui o extrato do banco.
      </p>
      <h2>Lei</h2>
      <p>
        Estes termos se regem pelas leis do Brasil. Direitos previstos na Lei Geral de Proteção de Dados estão descritos no aviso de privacidade e não são reduzidos por este texto.
      </p>
      <p>
        <Link href="/privacidade" className="text-violet-2">Ler o aviso de privacidade</Link>
      </p>
    </LegalShell>
  );
}
