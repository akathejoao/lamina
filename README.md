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
- `/app/resetar` zerar lançamentos ou restaurar o exemplo
- `/app/educacao` trilhas curtas
- `/baixar` instalar como aplicativo no Windows (PWA)

A janela da página inicial é uma demonstração neste navegador. A conta, em Entrar ou Criar conta, grava a planilha cifrada: o banco guarda o texto fechado, e a senha é a chave. Sem `DATABASE_URL`, o desenvolvimento usa um Postgres em memória, então as contas somem quando o servidor reinicia. Se `SESSION_SECRET` não estiver definida, a sessão local usa um segredo só desta máquina, em `.data/session-secret`, fora do git. No servidor publicado, defina `SESSION_SECRET` com 32 caracteres ou mais e `ADMIN_EMAIL` com o e-mail de quem administra. Esse e-mail não fica no código: no login, essa conta vira administradora, vê quem se cadastrou e marca o acesso como cortesia, ativo ou bloqueado, sem abrir a planilha de ninguém. Conta bloqueada não entra, não lê e não exporta. Com `DATABASE_URL`, as migrations em `migrations/` sobem no Postgres publicado. Em Perfil dá para exportar os dados, trocar a senha e apagar a conta.

## O que o agente entende

- `Gastei R$ 85 no mercado hoje`
- `Recebi R$ 400 de freelance`
- `Quanto posso gastar por dia até o fim do mês?`
- `Simule se eu guardar R$ 400 todo mês`
- um CSV com colunas `data`, `descricao`, `valor` e, se quiser, `tipo`

## Stack

Next.js, React, TypeScript, Tailwind CSS, Motion, Lucide e Recharts. Skills de interface usadas na direção visual ficam em `.agents/skills/`.
