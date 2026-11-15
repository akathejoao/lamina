# Lâmina

Planilha financeira no centro da tela e um agente ao lado. O mês fecha sozinho, a meta tem prazo, a reserva fica numa visão contínua. Dá para lançar um gasto digitando “Gastei R$ 85 no mercado hoje”.

A página inicial segue o ritmo de seções do Discord: título grande, dois botões e a janela do produto. A cor e o acabamento vêm do Misato: fundo quase preto, superfície um tom acima, borda translúcida e um violeta só nos botões de ação.

## Usar

```bash
npm install
npm run dev
```

Abre em `http://localhost:3847`.

- `/` apresentação, com a planilha de novembro já editável
- `/app` planilhas, saldo e vencimentos
- `/app/planilha/sheet-nov` planilha e agente
- `/app/perfil` termômetro, sequência no azul e preferências
- `/app/educacao` trilhas curtas
- `/baixar` instalar como aplicativo no Windows (PWA)

Os dados ficam neste navegador. Em Perfil, “Restaurar o exemplo da Marina” volta ao cenário inicial.

## O que o agente entende

- `Gastei R$ 85 no mercado hoje`
- `Recebi R$ 400 de freelance`
- `Quanto posso gastar por dia até o fim do mês?`
- `Simule se eu guardar R$ 400 todo mês`
- um CSV com colunas `data`, `descricao`, `valor` e, se quiser, `tipo`

## Stack

Next.js, React, TypeScript, Tailwind CSS, Motion, Lucide e Recharts. Skills de interface usadas na direção visual ficam em `.agents/skills/`.
