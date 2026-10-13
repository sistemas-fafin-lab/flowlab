# 01 — Shell: permissão, rotas e menu

**What to build:** o esqueleto navegável, sem banco.
- Quem tem `canManageIT` encontra no menu "Tecnologia":
  - **Início**: primeiro subitem, com ícone `Sparkles` e a pílula **EVA**;
  - **EVA**: a administração.
- O Início (`/it/inicio`) abre uma página provisória. O módulo do handoff entra na 03.
- A EVA (`/it/eva`) abre com quatro abas (Sugestões · Reuniões · Membros · Configurações), cada uma com estado vazio dizendo o que vai conter. Membros e Configurações só aparecem com `canApproveAgenteTI`.
- Sem as chaves, as rotas mostram "Acesso negado".

O ponto delicado é o item pai "Tecnologia":
- hoje ele usa `anyOf` com `canManageIT` e as chaves de Gastos de TI;
- ganha também `canApproveAgenteTI`;
- pela D8, o `href` do pai passa a ser `/it/inicio` para quem tem `canManageIT`. Hoje é `/it/dashboard`.

A pílula EVA segue o README do handoff (`docs/flowlab_agent/design_handoff_eva_home/README.md`, passo 3).

Plano: `docs/plans/agente-ti/PLANO_AGENTE_TI.md` §2 (D7, D8, D15, D18), §7 e §13 (Fase 0).

**Blocked by:** nenhuma; pode começar imediatamente.

**Status:** done (13/Out/2026)

- [x] `canApproveAgenteTI` em `ALL_PERMISSION_KEYS`, grupo `Tecnologia`, rótulo "Aprovar sugestões e configurar a EVA".
- [x] Chave na lista de exclusão do `operator` legado; caso novo em `permissions.test.ts`.
- [x] Nenhuma migration grava em `custom_roles` (D15).
- [x] Rotas `/it/inicio`, `/it/eva`, `/it/eva/reunioes`, `/it/eva/membros`, `/it/eva/configuracoes` com as permissões da §7.
- [x] `badge?: string` em `NavigationItem`. No `Link` do subitem expandido, o nome passa a ir junto da pílula (gradiente `blue-500 → violet-500`, 10px, bold), e o `Link` vai de `block` para `flex items-center`.
- [x] Subitens "Início" (`Sparkles`, `badge: 'EVA'`) e "EVA" (com `matchNested`). Rotas novas na lista de auto-expansão do grupo.
- [x] Item pai "Tecnologia": `anyOf` com a chave nova; `href` = `/it/inicio` para quem tem `canManageIT`, e o comportamento atual para os demais.
- [x] `src/modules/eva/index.ts` exportando a página provisória do Início e o `EvaAdminShell`, com as abas como `NavLink`.
- [x] `docs/CLAUDE.md` lista o módulo `eva/`.
- [x] `npx tsc --noEmit`, `npm run lint` (arquivos novos) e `npm test` sem erros novos.

## Comments

**13/Out/2026 — implementado** (branch `feat/agente-ti`, worktree `flowlab-agente-ti`).

- **Permissão:** `canApproveAgenteTI` em `src/utils/permissions.ts`, grupo Tecnologia, fora do `operator` legado; 3 casos novos em `permissions.test.ts`.
- **Rotas** (`src/App.tsx`):
  - `/it/inicio` exige `canManageIT`;
  - `/it/eva` e `/it/eva/reunioes` aceitam `canManageIT` ou `canApproveAgenteTI`;
  - `/it/eva/membros` e `/it/eva/configuracoes` exigem `canApproveAgenteTI`.
- **Menu** (`src/components/Layout.tsx`):
  - "Início" (`Sparkles` + pílula EVA) e "EVA" (`Bot`, `matchNested`);
  - `badge?: string` em `NavigationItem`; o `Link` do subitem passou de `block` para `flex items-center`;
  - item pai com `anyOf` incluindo a chave nova; `href` = `/it/inicio` (com `canManageIT`), `/it/eva` (só `canApproveAgenteTI`) ou `/it/gastos`;
  - rotas novas na auto-expansão.
- **Admin:** `components/admin/EvaAdminShell.tsx` (abas como `NavLink`; Membros e Configurações só aparecem para gestor) + `paginas.tsx` com estado vazio explícito em cada aba.
- **Desvio da descrição:** a página provisória do Início não foi criada. Como a 03 foi feita na mesma rodada, o Início já entrou com o módulo do handoff.
- `docs/CLAUDE.md` lista o módulo `eva/`.

**Verificação:**
- `tsc`: nenhum erro nos arquivos tocados. Os 25 que restam são os antigos de `MindMapNodes.tsx` e `ITProjectMindMap.tsx`.
- `eslint`: nada nas linhas alteradas de `Layout.tsx` e `permissions.ts`; os apontamentos restantes nesses arquivos já existiam.

**Não verificado:** o menu no navegador com login real (admin; cargo só com `canApproveAgenteTI`).
