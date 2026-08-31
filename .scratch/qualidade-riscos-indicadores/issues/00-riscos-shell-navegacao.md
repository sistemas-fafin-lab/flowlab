# 00 — Riscos: shell de navegação da nova aba

**What to build:** a entrada "Riscos" existe na navegação do módulo Qualidade
(mesmo padrão de `AbasChips`/rotas usado por Ocorrências/Cortesias/IHQ/Câncer)
e leva a uma página vazia/placeholder, com controle de acesso por
`department = 'Qualidade'` já funcionando — sem nenhuma tabela ou regra de
negócio ainda. Existe só para 01 e 03 poderem entregar conteúdo em paralelo
sem os dois mexerem nos mesmos arquivos de rota/menu ao mesmo tempo.

Referência de layout: `src/components/Layout.tsx` e `src/App.tsx` deste
repo (padrão já usado pelas abas existentes de Qualidade).

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Item "Riscos" aparece na navegação da aba Qualidade para quem tem
      acesso ao `department = 'Qualidade'`.
- [x] Rota `/qualidade/riscos` renderiza uma página placeholder, protegida
      pelo mesmo mecanismo de acesso das demais abas.
- [x] `npx tsc --noEmit` sem erros novos.

## Comments

Implementado espelhando exatamente o padrão das outras 4 abas de Qualidade
(Ocorrências/Cortesias/IHQ/Câncer): `RiscosPage` placeholder em
`src/modules/qualidade/components/RiscosPage.tsx`, exportado em
`src/modules/qualidade/index.ts`, rota `/qualidade/riscos` em `src/App.tsx`
(mesmo `ProtectedRoute anyOf={['canViewQualidade','canManageQualidade']}` das
demais — o controle de acesso do módulo Qualidade neste repo já é por essas
permissions, não por `department` diretamente, ver comentário no topo de
`src/modules/qualidade/index.ts`), e item de menu + ícone `AlertOctagon` em
`src/components/Layout.tsx`. `npx tsc --noEmit` e `npx vitest run` (224
testes) sem regressões; `/code-review` não encontrou problemas nas mudanças
de rota/shell.
