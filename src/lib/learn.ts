export type Pill = { title: string; body: string };

export type Trail = {
  id: string;
  title: string;
  summary: string;
  pills: Pill[];
};

// Pílulas curtas, de leitura de um minuto. Sem estatística e sem número de mercado: o que muda
// com o tempo (taxa, limite, prazo) manda conferir na fonte oficial em vez de citar valor.
export const trails: Trail[] = [
  {
    id: "dividas",
    title: "Sair das dívidas sem sumir do mapa",
    summary: "Ordem de ataque, negociação com número e o que fazer com o livre do mês.",
    pills: [
      {
        title: "Liste o que cobra juros primeiro",
        body: "Cartão rotativo e cheque especial vêm antes da parcela do notebook. Anote saldo, taxa e data. A planilha já mostra a parcela; o que falta é a taxa, que mora no app do banco.",
      },
      {
        title: "Veja tudo o que deve num lugar só",
        body: "O Registrato, do Banco Central, mostra as dívidas e os contratos que você tem em bancos e financeiras. Antes de negociar, saiba o total. Desconfie de quem liga oferecendo desconto sem você ter pedido.",
      },
      {
        title: "Pague o mínimo só para não atrasar",
        body: "O mínimo evita multa. O que sobra do livre do mês vai para a dívida mais cara, não para todas ao mesmo tempo.",
      },
      {
        title: "Negocie com número na mão",
        body: "Leve o total de 12 meses daquela conta, não um desabafo. “Consigo R$ 180 por mês durante 8 meses” fecha mais acordo do que “está apertado”. Peça o novo contrato por escrito antes de pagar a primeira parcela.",
      },
    ],
  },
  {
    id: "reserva",
    title: "Reserva de emergência",
    summary: "Quanto guardar, quando separar e onde deixar o dinheiro.",
    pills: [
      {
        title: "Comece por um mês de essencial",
        body: "Essencial aqui é moradia, contas, mercado e transporte. Não entre lazer. Um mês disso já evita o cartão no imprevisto pequeno.",
      },
      {
        title: "Separe no dia do salário",
        body: "O aporte de reserva entra como investimento, não como o que sobrou no dia 28. Se esperar sobrar, não sobra.",
      },
      {
        title: "Onde deixar",
        body: "Liquidez diária, sem risco de oscilar. Tesouro Selic ou CDB com liquidez diária. A reserva não é para render história; é para estar lá.",
      },
      {
        title: "Quantos meses cobrir",
        body: "Depende de quão estável é a sua renda. Quem tem salário fixo costuma mirar poucos meses de essencial; quem recebe por projeto ou tem dependentes precisa de uma margem maior. Defina o valor em Perfil, na meta da reserva.",
      },
    ],
  },
  {
    id: "fixos",
    title: "Negociar gastos fixos",
    summary: "Contas que se repetem todo mês e que quase sempre aceitam conversa.",
    pills: [
      {
        title: "Uma conta por semana",
        body: "Internet, celular, academia, seguro. Abrir todas no mesmo dia cansa e você aceita a primeira oferta.",
      },
      {
        title: "Peça o valor de quem entra agora",
        body: "Operadoras cobram menos de cliente novo. Diga o plano e o preço que viu no site, e peça para igualar. Anote a data do desconto.",
      },
      {
        title: "Corte o que não tem uso em 30 dias",
        body: "Assinatura pequena esquecida pesa no ano. A dica do agente aponta as de menos de R$ 20. Decida uma a uma.",
      },
      {
        title: "Anote o dia da renovação",
        body: "Seguro, plano de saúde e internet costumam reajustar na renovação. Registre o dia de vencimento na planilha: o que vence em até sete dias aparece no início do app, e dá tempo de comparar antes de renovar.",
      },
    ],
  },
  {
    id: "cartao",
    title: "Cartão de crédito sem susto",
    summary: "Fatura, fechamento, parcelas e o que não fazer com o mínimo.",
    pills: [
      {
        title: "Fechamento não é vencimento",
        body: "A fatura fecha num dia e vence dias depois. Compra feita depois do fechamento cai só na fatura seguinte. Anote os dois dias do seu cartão e lance a compra na planilha no dia em que passou.",
      },
      {
        title: "Pague a fatura inteira",
        body: "O pagamento mínimo joga o resto no crédito rotativo, um dos juros mais caros que existem. Se a fatura não cabe, é sinal para olhar o que foi parcelado, não para pagar o mínimo.",
      },
      {
        title: "Parcelado sem juros também pesa",
        body: "Sem juros não quer dizer sem custo: a parcela ocupa o limite e o orçamento dos meses seguintes. Lance a parcela como 3/12 na planilha para ver quantos meses de compromisso você já carrega.",
      },
      {
        title: "Limite não é renda",
        body: "O limite do cartão é o máximo que o banco aceita emprestar, não o que você pode gastar. Escolha um teto seu, dentro da fatia de estilo de vida, e trate o resto do limite como se não existisse.",
      },
    ],
  },
  {
    id: "investir",
    title: "Começar a investir com o chão firme",
    summary: "Ordem certa: reserva primeiro, valor pequeno e repetido, metas separadas.",
    pills: [
      {
        title: "Reserva antes de ação",
        body: "Sem reserva, a primeira queda vira venda no pior dia. O termômetro só chama de Investidor quem já passou da metade da reserva.",
      },
      {
        title: "Um valor chato e repetido",
        body: "R$ 200 todo mês ensina mais do que R$ 2.000 uma vez. Use a simulação do agente para ver em quantos meses a meta fecha.",
      },
      {
        title: "Não misture viagem com aposentadoria",
        body: "A meta do Japão e a reserva moram em planilhas diferentes de propósito. Misturar faz você gastar a reserva achando que é cofre de viagem.",
      },
      {
        title: "Olhe prazo, liquidez e imposto",
        body: "Antes do nome do produto, pergunte quando você pode resgatar, se o valor pode cair e quanto de imposto sai. Na renda fixa o imposto é cobrado no resgate e diminui com o tempo aplicado, então tirar cedo custa mais.",
      },
    ],
  },
  {
    id: "ir",
    title: "Imposto de renda, o básico",
    summary: "Quem declara, o que guardar durante o ano e como não pegar a malha fina.",
    pills: [
      {
        title: "Veja se você precisa declarar",
        body: "A obrigatoriedade depende de regras que a Receita Federal atualiza a cada ano, como a renda recebida e os bens que você tem. Confira a lista do ano no site da Receita antes do prazo, que costuma ser de março a maio.",
      },
      {
        title: "Guarde os comprovantes o ano todo",
        body: "Informe de rendimentos, recibos de médico e dentista, mensalidade escolar. Foto no celular numa pasta já resolve. Na planilha, use a categoria Saúde para somar o que pode entrar como dedução.",
      },
      {
        title: "Use a declaração pré-preenchida",
        body: "A Receita já traz parte dos dados vindos de empregadores, bancos e planos de saúde. Isso poupa digitação, mas não dispensa conferir: o que está errado ou faltando é problema seu na hora da análise.",
      },
      {
        title: "Se errou, retifique",
        body: "Esqueceu um rendimento ou um recibo? A declaração pode ser retificada pelo mesmo programa, e corrigir por conta própria costuma sair mais barato do que esperar a Receita encontrar a diferença.",
      },
    ],
  },
  {
    id: "mei",
    title: "MEI, o básico",
    summary: "Misturar conta pessoal e do negócio é o erro mais comum. Comece separando.",
    pills: [
      {
        title: "Separe o dinheiro do negócio",
        body: "Abra uma planilha só do MEI e, se der, uma conta só dele. Pro-labore e retirada são o que você tira para a vida pessoal; o resto fica no negócio. Misturar esconde se a atividade dá lucro.",
      },
      {
        title: "Pague a guia todo mês",
        body: "O MEI paga uma guia mensal fixa, a DAS, com vencimento no dia 20. Lance como gasto fixo com vencimento no dia 20 e ela aparece em Vence em breve. Atrasar gera multa e pode travar benefícios.",
      },
      {
        title: "Anote cada venda",
        body: "A declaração anual do faturamento depende da soma do que você recebeu. Lance as entradas do negócio com a data, mesmo as pequenas. No fim do ano a soma já está feita.",
      },
      {
        title: "Conheça o limite de faturamento",
        body: "O MEI tem um teto de faturamento anual definido em lei. O valor muda, então confira o atual no Portal do Empreendedor. Passar do teto muda o enquadramento e o imposto, e é melhor saber antes.",
      },
    ],
  },
  {
    id: "compras",
    title: "Planejar uma compra grande",
    summary: "Notebook, moto, reforma ou viagem: de quanto por mês você precisa para chegar lá.",
    pills: [
      {
        title: "Transforme o preço em parcela por mês",
        body: "Divida o valor pelos meses que faltam até a data. R$ 6.000 em 10 meses são R$ 600 por mês. Se esse valor não cabe no Futuro do mês, a data ou a compra precisa mudar. Crie uma planilha de meta com prazo.",
      },
      {
        title: "Espere antes de comprar",
        body: "Se a compra não é urgente, deixe a vontade esperar alguns dias. Quem ainda quer o item depois disso quase sempre sabe por quê. Quem esquece economizou sem esforço.",
      },
      {
        title: "Compare à vista com o parcelado",
        body: "Pergunte o preço à vista, o parcelado sem juros e o parcelado com juros. Se o desconto à vista é bom e você tem o valor guardado, ele costuma ganhar. Se for financiar, peça o CET, o custo efetivo total, e compare esse número.",
      },
      {
        title: "Não use a reserva",
        body: "A reserva é para imprevisto. Uma compra planejada tem a sua própria meta. Se juntou menos do que precisa, adie a compra em vez de abrir o cofre do emprego ou da saúde.",
      },
    ],
  },
];
