# 01 — Shell: permissões, rotas e menu

**What to build:** o esqueleto navegável do módulo, sem banco. Um usuário com
`canViewGastosTI` ou `canManageGastosTI` encontra "Gastos de TI" dentro do menu
"Tecnologia" e abre uma página com cabeçalho e quatro abas (Dashboard · Despesas ·
Mês a mês · Orçamento), cada uma com um estado vazio explícito dizendo o que vai
conter. Sem nenhuma das chaves, as rotas mostram "Acesso negado" e o subitem não
aparece.

O ponto delicado é o item pai "Tecnologia": hoje ele exige `canManageIT` e aponta para
`/it/dashboard`. Quem só tem as chaves de gastos (ex.: Financeiro) não veria o menu e,
se visse, cairia em "Acesso negado" ao clicar no rótulo do pai. Ver §5 do plano.

Plano: `docs/plans/gastos-ti/PLANO_GASTOS_TI.md` §5 e §10 (Fase 0).

**Blocked by:** Nenhuma — pode começar imediatamente.

**Status:** done

- [x] `canViewGastosTI` e `canManageGastosTI` em `ALL_PERMISSION_KEYS`, grupo `Tecnologia`.
- [x] As duas na lista de exclusão do `operator` legado; casos novos em `permissions.test.ts`.
- [x] Nenhuma migration: as chaves não são gravadas em `custom_roles` (D14).
- [x] Rotas `/it/gastos`, `/it/gastos/despesas`, `/it/gastos/mes-a-mes`, `/it/gastos/orcamento` sob `ProtectedRoute anyOf`.
- [x] Subitem "Gastos de TI" no menu "Tecnologia", destacado também nas sub-rotas.
- [x] Item pai "Tecnologia" com `anyOf` das três chaves e `href` dependente de `canManageIT`.
- [x] Rotas novas na lista que abre o grupo "Tecnologia" automaticamente.
- [x] Módulo `src/modules/gastos-ti/` com `index.ts`, shell com cabeçalho e abas no visual do `ITHubDashboard`.
- [x] `docs/CLAUDE.md` lista o módulo.
- [x] `npx tsc --noEmit`, `npm run lint` (arquivos novos) e `npm test` sem erros novos.

## Comments

**01/Out/2026 — implementado.**

- **Permissões:** `src/utils/permissions.ts` + 3 casos novos em `permissions.test.ts`.
- **Rotas:** `src/App.tsx`, as quatro sob `anyOf` das duas chaves.
- **Módulo:** `src/modules/gastos-ti/`
  - `GastosTIShell`: cabeçalho violeta + abas como `NavLink`, uma rota por aba.
  - `ui/EmConstrucao`: estado vazio explícito.
  - Uma página por aba em `dashboard/`, `despesas/`, `mes-a-mes/` e `orcamento/`, pastas já no formato da §6 do plano.
- **Menu:** `src/components/Layout.tsx`
  - O subitem "Gastos de TI" usa o ícone `Coins`, porque `Wallet` já é de "Controle de Custos".
  - O item pai "Tecnologia" passou de `permission: 'canManageIT'` para `anyOf` das três chaves. O `href` do pai é `/it/gastos` para quem não tem `canManageIT`.
  - Quem tem só `canManageIT` vê o menu exatamente como antes.

**Destaque nas sub-rotas:** o `Layout` comparava o caminho exato, e por isso "Gastos de TI" perdia o destaque em `/it/gastos/despesas`. Qualidade tem a mesma limitação em `/qualidade/riscos/matriz`. Foi criada a opção `matchNested` em `NavigationItem`, usada só pelo subitem novo. Sem ela, vale a comparação exata de sempre, então nenhum outro menu mudou de comportamento.

**Verificação:**
- `npm test`: 56 arquivos, 580 testes passando.
- Build do Vite: ok, com saída no scratchpad.
- `tsc`: nenhum erro nos arquivos alterados. Os 25 que restam já existiam em `MindMapNodes.tsx`, `ITProjectMindMap.tsx` e páginas de Qualidade.
- `eslint`: nenhum problema nos arquivos novos. Os 11 apontados em `Layout.tsx`/`permissions.ts` estão em linhas não alteradas.

**Ambiente:** o `node_modules` local estava sem 4 pacotes já declarados no `package.json` e no lockfile (`vitest`, `@tanstack/react-query`, `pdf-lib`, `pdf-parse`). Sem eles, nem os testes nem o build rodavam. Foi rodado `npm install`, que não alterou nenhum arquivo versionado.

**Não verificado:** navegação no navegador com login real. Fica para conferir com um admin: o menu, as quatro abas e o destaque do subitem. Também falta conferir com um cargo que tenha só `canViewGastosTI`: ver só "Gastos de TI" dentro de "Tecnologia".
