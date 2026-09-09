# 01 — Editar e excluir uma linha de Fonte Pagadora

**What to build:** dentro de Controle de Custos > Fontes Pagadoras
(`PayorsScreen.tsx`), com uma fonte pagadora selecionada (visão
`TabelaExamesDaFonte`), cada linha ganha ações de **editar** e **excluir**,
espelhando o padrão já usado na aba Exames (`ExamFormModal.tsx` /
`ExamTable.tsx`).

- "Editar" abre um modal (mesmo estilo do `ExamFormModal`: div fixed +
  backdrop, formulário com `useState` puro, sem React Hook Form/Zod) com os
  campos da linha: **Fonte Pagadora**, **Tabela Associada**, **TUSS** e
  **Valor Cobrado** — todos texto livre editável (sem travar TUSS num
  seletor do catálogo de Exames). Único campo obrigatório: Fonte Pagadora
  não pode ficar vazia.
- "Excluir" pede confirmação via `ConfirmDialog` (mesmo hook `useDialog` já
  usado em Exames) e remove a linha (`DELETE` físico, sem soft-delete —
  mesmo padrão de `deleteExam`).
- Feedback de sucesso/erro via `useNotification`/`Notification`, igual às
  outras telas do módulo.
- O rótulo do rodapé da tabela ("Dados somente leitura — espelhados do
  APLIS") deixa de fazer sentido e precisa ser trocado por um texto que
  reflita que a linha agora é editável manualmente (a reimportação
  continua sobrescrevendo essas edições sem aviso especial — comportamento
  aceito).
- Acesso: `canManageBilling` — mesma permissão de escrita já usada pela RLS
  policy de `custo_fontes_pagadoras` (nenhuma migration nova necessária,
  a não ser que a policy de escrita atual esteja restrita à coluna
  `atendido`; se estiver, ampliar pra cobrir os demais campos).
- Casamento de identidade da linha: usa o `payorId` já presente em
  `ExameDaFontePagadora` (join feito em `domain/busca.ts`) — não precisa
  de nova lógica de busca.

**Blocked by:** Nenhum — pode começar imediatamente.

**Status:** done

- [x] Usuário com `canManageBilling`, com uma fonte pagadora selecionada,
      vê ações de editar/excluir em cada linha de `TabelaExamesDaFonte`
- [x] Usuário sem `canManageBilling` não vê/não consegue acionar essas
      ações
- [x] Editar abre modal pré-preenchido com Fonte Pagadora, Tabela
      Associada, TUSS e Valor Cobrado, todos editáveis como texto livre
- [x] Salvar edição sem Fonte Pagadora preenchida é bloqueado (campo
      obrigatório)
- [x] Salvar edição atualiza a linha em `custo_fontes_pagadoras` e reflete
      na tabela sem precisar recarregar a página
- [x] Excluir pede confirmação antes de remover a linha
- [x] Confirmar exclusão remove a linha do banco e da tabela
- [x] Rótulo do rodapé deixa de dizer "somente leitura"

## Comments

Implementado em `PayorFormModal.tsx` (novo, clone de `ExamFormModal.tsx`) +
`updatePayor`/`deletePayor` em `useCostControl.ts` + ações de
editar/excluir em `TabelaExamesDaFonte` (`PayorsScreen.tsx`), reaproveitando
`ConfirmDialog`/`useDialog` e `useNotification` já usados no resto do
módulo.
