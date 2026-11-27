# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Adults in Brazil (18+) who want to organize their own money month by month without a complicated spreadsheet. They use it on a phone or a computer, often installed as a PWA. The core job: log what came in and went out by typing an everyday phrase ("gastei 85 no mercado", "vale alimentação de 350 reais") and see at a glance how much still fits in the month. The site has one admin, defined by `ADMIN_EMAIL`, who manages access (cortesia, ativo, bloqueado) without seeing anyone's spreadsheet.

## Product Purpose

Lâmina is a personal-finance spreadsheet with an agent beside it. A monthly cycle closes on its own, there are goals with deadlines, and the reserve is shown as a continuous view. A month is split into essenciais, estilo and futuro (50/30/20 by default, adjustable). Success means the person logs their real spending with little friction, understands where the month is going, and builds a reserve.

## Positioning

All four of these are confirmed as the product's difference:

- **Agent by phrase:** a local interpreter, not AI, that understands Portuguese money phrases, amounts written as "5.400", "85,50", "mil" or "k", relative dates, questions ("quanto gastei esse mês?", "qual meu saldo?") and undo.
- **Encrypted privacy:** the spreadsheet is encrypted with a key derived from the person's password (AES-256-GCM, scrypt). The server stores only ciphertext and cannot read entries. A forgotten password means the entries cannot be recovered.
- **Spreadsheet at the center:** the whole month fits on one screen as a spreadsheet, not as a bank app.
- **Financial education:** short learning trails and tips computed from the person's own data.

## Operating Context

- Account flow: create an account, open a spreadsheet, log entries through the chat or a form, review the month split, set the reserve goal.
- CSV import and export work with Excel exports. Files use ";" as separator and Windows-1252 or UTF-8 encoding.
- A demo spreadsheet that needs no account lives at `/` and `/demo`, stored only in the browser.

## Capabilities and Constraints

- **Stage:** free and in testing with people close to the author. There is no charging yet and no decided paid plan.
- **Stack:** Next.js 16 App Router, React 19, Tailwind v4 and Motion. It deploys on Vercel with Neon Postgres; development uses PGlite.
- **Language:** all user-facing copy is in Brazilian Portuguese.
- **Legal:** LGPD applies. Consent is collected at sign-up, data export covers both account and spreadsheet, and deleting the account erases everything. Accounts are adult-only.
- **Terminology:** planilha, ciclo mensal, lançamento, agente, divisão do mês (essenciais, estilo, futuro), reserva, termômetro, trilhas.
- **Undecided:** pricing, the paid plan, and email verification.

## Brand Commitments

- **Name:** Lâmina, a blade and also a sheet.
- **Visual identity in place:** the "Misato" palette (near-black canvas, violet only on actions), the ledger/blade language documented in `src/app/globals.css`, and the Syne, Outfit and IBM Plex Mono fonts. Visual decisions belong in DESIGN.md, not here. A "Banca da feira" redesign was tried and rejected by the owner; keep this identity.
- **Voice:** direct, plain Portuguese, no jargon, honest about limits (for example, "nem a gente lê os lançamentos").

## Evidence on Hand

- **Demo data:** the seed spreadsheet (`src/lib/seed.ts`) and the learning trails (`src/lib/learn.ts`).
- **Absent:** there are no real users, testimonials, metrics, press or customer logos. Do not fabricate any.

## Product Principles

1. Writing a phrase must be faster than filling a form; the agent should ask when unsure rather than guess.
2. Privacy is structural, not a promise: never design features that require the server to read entries.
3. The month on one screen: numbers first, decoration never competes with figures.
4. Teach with the person's own numbers, not generic advice.
5. Be honest about limits and irreversible actions.

## Accessibility & Inclusion

Mobile-first use, with touch targets of 40px or more. Respect reduced motion. Keep WCAG AA contrast on the dark canvas.
