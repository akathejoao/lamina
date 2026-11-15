import Link from "next/link";
import { LegalShell } from "@/components/legal-shell";

export default function PrivacyPage() {
  return (
    <LegalShell kicker="Aviso de privacidade · versão 2026-11-15" title="O que a conta guarda, e o que ela não consegue ler.">
      <p>
        Este aviso descreve o tratamento de dados pessoais da Lâmina, nos termos da Lei nº 13.709/2018 (LGPD). Quem opera esta cópia do serviço é o controlador. Se a Lâmina estiver publicada para você por outra pessoa ou empresa, essa pessoa ou empresa é a controladora e deve indicar um canal de contato além das ferramentas da própria conta.
      </p>
      <h2>Quais dados</h2>
      <p>Conta: nome, e-mail, hash da senha, data do consentimento e a versão dos termos aceitos.</p>
      <p>
        Planilha: lançamentos, metas, mensagens com o agente e preferências de perfil, inclusive uma foto se você enviar. Esse conjunto é cifrado com uma chave exclusiva da sua conta antes de ser gravado. A chave é embrulhada com a sua senha. O banco guarda o texto cifrado, não os valores em aberto.
      </p>
      <p>Não pedimos CPF, telefone, endereço nem dados bancários de acesso.</p>
      <h2>Para quê</h2>
      <p>Para criar a conta, autenticar você e guardar a planilha entre aparelhos. O agente usa os números da sua planilha só para responder dentro do produto. Não vendemos esses dados e não usamos a planilha para publicidade.</p>
      <h2>Base legal</h2>
      <p>
        Consentimento (art. 7º, I), registrado no cadastro e revogável com a exclusão da conta, e execução do serviço que você pediu (art. 7º, V). O cookie de sessão é estritamente necessário para manter o acesso.
      </p>
      <h2>Quem mais vê</h2>
      <p>
        O operador de hospedagem processa o banco como operador, para manter o serviço no ar. Não há compartilhamento com redes de anúncio. Um pedido legal dirigido ao controlador pode obrigar a entrega do que estiver em poder dele; a planilha em texto aberto não está no banco.
      </p>
      <h2>Por quanto tempo</h2>
      <p>Enquanto a conta existir. Ao apagar a conta, com a senha, o cadastro e a planilha cifrada são excluídos. Cópias de segurança do operador, se existirem, seguem o prazo da hospedagem e não são usadas para outro fim.</p>
      <h2>Os seus direitos</h2>
      <p>Acesso e portabilidade: em Perfil, exporte um arquivo JSON da planilha já aberta.</p>
      <p>Correção: edite nome, foto e lançamentos na própria conta. O e-mail identifica a conta e não muda por aqui.</p>
      <p>Eliminação e revogação do consentimento: apague a conta em Perfil. Isso não pode ser desfeito e a planilha deixa de ser recuperável.</p>
      <p>Informação sobre o tratamento: este aviso. Outros pedidos previstos na LGPD devem ser dirigidos ao controlador desta cópia.</p>
      <h2>Segurança e senha</h2>
      <p>
        A senha não fica gravada. Se você a perder, não há como reabrir a planilha. Use uma senha que só você saiba e não a repita de outro serviço.
      </p>
      <h2>Crianças</h2>
      <p>A Lâmina não é dirigida a menores de 18 anos. O cadastro pede essa confirmação.</p>
      <h2>Cookie</h2>
      <p>Um cookie httpOnly, chamado lamina_session, guarda a sessão por 14 dias. Sem ele, a chave da planilha não acompanha o navegador. Não usamos cookie de rastreamento.</p>
      <p>
        <Link href="/termos" className="text-violet-2">Ler os termos de uso</Link>
      </p>
    </LegalShell>
  );
}
