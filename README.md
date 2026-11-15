# Skills de UI e UX

Skills de agente para desenhar, construir e revisar interfaces. O Cursor carrega cada pasta em `.agents/skills/` que contém um `SKILL.md`. Não há servidor para subir: abra este projeto e peça trabalho de interface.

## Instaladas

| Pedido | Skill | O que cobre | Origem |
| --- | --- | --- | --- |
| uiuxpromax | `ui-ux-pro-max` | Estilos, paletas, tipografia, UX e stacks (inclui shadcn). A busca local fica em `scripts/search.py`. | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) |
| framermotion | `framer-motion` | Motion (antes Framer Motion) em React: import `motion/react`, performance e padrões. | [Mindrally/skills](https://github.com/Mindrally/skills) |
| webanimationdesign | `web-animation-design` | Easing, duração, springs e `prefers-reduced-motion`, a partir do curso de Emil Kowalski. | [vercel-labs/open-agents](https://github.com/vercel-labs/open-agents) |
| shadcn | `shadcn` | Skill oficial: CLI, composição, formulários, tema e registries. | [shadcn-ui/ui](https://github.com/shadcn-ui/ui) |
| frontendui | `frontend-ui` | Direção visual distinta, com base no cookbook de estética de frontend. | [WomenDefiningAI/claude-code-skills](https://github.com/WomenDefiningAI/claude-code-skills) |
| frontenddesign | `frontend-design` | Direção estética, tipografia e escolha visual antes do código. Licença Apache 2.0 em `LICENSE.txt`. | [anthropics/skills](https://github.com/anthropics/skills) |
| frontenddesignsystems | `frontend-design-systems` | Interfaces em React, Tailwind e shadcn/ui com espaçamento, alinhamento e hierarquia. | [composio-community/opencode-skills](https://github.com/composio-community/opencode-skills) |
| uidesign | `ui-design` | UI em React/Next/Tailwind, dark mode, responsivo e auditoria visual. | [mblode/agent-skills](https://github.com/mblode/agent-skills) |

A procedência e o hash de cada cópia estão em `skills-lock.json`.

## Como usar

Peça o trabalho em linguagem normal. O agente escolhe a skill pela descrição do `SKILL.md`.

- Página, dashboard ou revisão de UX: `ui-ux-pro-max`, `frontend-design`, `frontend-ui`, `ui-design`.
- Componentes shadcn, `components.json` ou preset: `shadcn` e `frontend-design-systems`.
- Animação, easing ou Motion: `web-animation-design` e `framer-motion`.

Para consultar a base do UI/UX Pro Max:

```bash
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "dashboard fintech" --design-system -p "Nome"
```

## Atualizar

Na raiz do projeto, com Node.js 22:

```bash
npx skills update
```

Para reinstalar uma skill:

```bash
npx skills add <owner/repo> --skill <nome> -a cursor -y --copy
```
