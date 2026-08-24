# 05 — Ações de gerenciamento de cards

**What to build:** em cima da tela "Board" já funcional (ticket 04), quem tem
`canManageBoard` (ou `canManageAllBoards`) no board que enxerga consegue
criar, editar, mover entre colunas e excluir cards. Quem só tem visualização
(cargo com `board_id` mas sem `canManageBoard`, e sem `canManageAllBoards`)
continua vendo o board normalmente, sem essas ações disponíveis na interface.

Drag-and-drop entre colunas usa o mesmo comportamento já existente no board
de TI (componente compartilhado do ticket 01).

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Usuário com `canManageBoard` consegue criar um card novo no board do
      próprio cargo, preenchendo os campos genéricos (título, descrição,
      responsável, prazo, prioridade).
- [ ] Usuário com `canManageBoard` consegue editar e excluir um card
      existente no board do próprio cargo.
- [ ] Usuário com `canManageBoard` consegue mover um card entre colunas via
      drag-and-drop, persistindo a mudança de `kanban_status`.
- [ ] Usuário com `canManageAllBoards` consegue fazer as três ações acima em
      qualquer board, independente do próprio cargo.
- [ ] Usuário sem `canManageBoard` e sem `canManageAllBoards` não vê/consegue
      acionar nenhuma dessas ações, mesmo tentando direto (RLS bloqueia
      escrita mesmo que a UI falhe em esconder o botão).
- [ ] `npm run lint` e typecheck limpos.
