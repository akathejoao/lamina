# Lâmina

Planilha financeira no centro da tela e um agente ao lado. O mês fecha sozinho, a meta tem prazo, a reserva fica numa visão contínua. Em Nova planilha dá para partir de um modelo, nomear as categorias, escolher a cor e ajustar a divisão. Dá para lançar um gasto digitando “Gastei R$ 85 no mercado hoje”.

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

A janela da página inicial é uma demonstração neste navegador. A conta, em Entrar ou Criar conta, grava a planilha cifrada: o banco guarda o texto fechado, e a senha é a chave. Sem `DATABASE_URL`, o desenvolvimento usa um Postgres em memória, então as contas somem quando o servidor reinicia. A sessão local, se `SESSION_SECRET` não estiver definida, fica em `.data/session-secret`. Com `DATABASE_URL`, as migrations em `migrations/` sobem no Postgres publicado. Em Perfil dá para exportar os dados, trocar a senha e apagar a conta. A conta `joaopro9678@gmail.com` é a administradora: ela abre a aba Administração, vê quem se cadastrou e marca o acesso como cortesia, ativo ou bloqueado, sem abrir a planilha de ninguém.

## O que o agente entende

- `Gastei R$ 85 no mercado hoje`
- `Recebi R$ 400 de freelance`
- `Quanto posso gastar por dia até o fim do mês?`
- `Simule se eu guardar R$ 400 todo mês`
- um CSV com colunas `data`, `descricao`, `valor` e, se quiser, `tipo`

## Stack

Next.js, React, TypeScript, Tailwind CSS, Motion, Lucide e Recharts. Skills de interface usadas na direção visual ficam em `.agents/skills/`.
