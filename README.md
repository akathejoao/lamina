# Lâmina

Planilha financeira no centro da tela e um agente ao lado. O mês fecha sozinho, a meta tem prazo, a reserva fica numa visão contínua. Em Nova planilha dá para partir de um modelo, nomear as categorias, escolher a cor e ajustar a divisão. Dá para lançar um gasto digitando “Gastei R$ 85 no mercado hoje”.

A página inicial segue o ritmo de seções do Discord: título grande, dois botões e a janela do produto. A cor e o acabamento vêm do Misato: fundo quase preto, superfície um tom acima, borda translúcida e um violeta só nos botões de ação.

## Usar

```bash
npm install
npm run dev
```

Abre em `http://localhost:3847`.

- `/` apresentação, com a planilha de exemplo já editável
- `/demo` a mesma planilha de exemplo em tela cheia, sem conta
- `/entrar` e `/criar-conta` acesso à conta
- `/app` planilhas, saldo e vencimentos (pede login)
- `/app/planilha/[id]` planilha e agente
- `/app/perfil` termômetro, sequência no azul e preferências
- `/app/resetar` zerar a conta (o link fica em Perfil)
- `/app/educacao` trilhas curtas
- `/baixar` instalar como aplicativo no Windows (PWA)

A janela da página inicial é uma demonstração neste navegador. A conta, em Entrar ou Criar conta, grava a planilha cifrada: o banco guarda o texto fechado, e a senha é a chave. Sem `DATABASE_URL`, o desenvolvimento usa um Postgres em memória, então as contas somem quando o servidor reinicia. Se `SESSION_SECRET` não estiver definida, a sessão local usa um segredo só desta máquina, em `.data/session-secret`, fora do git. Na Vercel (ou qualquer hospedagem), `DATABASE_URL` e `SESSION_SECRET` (32+ caracteres) são obrigatórios; sem eles a conta não sobe. Defina também `ADMIN_EMAIL` com o e-mail de quem administra e `ADMIN_SETUP_TOKEN` (16+ caracteres). Esse e-mail não fica no código e não tem verificação por e-mail, então o cadastro dele pede o código de `ADMIN_SETUP_TOKEN`; sem o código, ninguém registra esse endereço na hospedagem. O papel de administrador vem só do `ADMIN_EMAIL` atual: trocar a variável tira o acesso de quem saiu. Essa conta vê quem se cadastrou e marca o acesso como cortesia, ativo ou bloqueado, sem abrir a planilha de ninguém. Conta bloqueada não entra, não lê e não exporta, mas pode apagar a conta com e-mail e senha. Com `DATABASE_URL`, as migrations em `migrations/` sobem no Postgres no build. Em Perfil dá para exportar os dados, trocar a senha e apagar a conta.

## Hospedar na Vercel

1. Conecte o repositório no painel da Vercel.
2. Crie um Postgres (Vercel Storage ou Neon) e ligue `DATABASE_URL` (e, se existir, `DATABASE_URL_UNPOOLED`).
3. Em Environment Variables, defina `SESSION_SECRET`, `ADMIN_EMAIL` e `ADMIN_SETUP_TOKEN`. Crie a conta do admin em `/criar-conta` com o código.
4. Faça o deploy. O build roda `next build` e aplica as migrations.

## O que o agente entende

- `Gastei R$ 85 no mercado hoje`
- `Recebi R$ 400 de freelance`
- `Quanto posso gastar por dia até o fim do mês?`
- `Simule se eu guardar R$ 400 todo mês`
- um CSV com colunas `data`, `descricao`, `valor` e, se quiser, `tipo`

## Stack

Next.js, React, TypeScript, Tailwind CSS, Motion e Lucide. Skills de interface usadas na direção visual ficam em `.agents/skills/`.
