# 04 — Tela "Board" genérica — visualização

**What to build:** a rota `/board`, nova no módulo `src/modules/board/`
(spec: `.scratch/board-multidepartamento/spec.md`). Um funcionário com um
cargo vinculado a um board (via `custom_roles.board_id`) abre `/board` e vê o
kanban do seu departamento — colunas e cards, renderizados pelo componente de
Kanban compartilhado (ticket 01), com os dados vindos de `board_tickets`
filtrados pela RLS (ticket 02) e o gate de acesso decidido por
`resolveBoardAccess` (ticket 03). Quem não tem `board_id` nem
`canManageAllBoards` vê uma tela de acesso negado, não um erro ou tela em
branco.

Este ticket cobre só a visualização (read-only) de um único board — sem
ações de criar/editar/mover/excluir card (ticket 05) e sem seletor para quem
tem acesso a mais de um board (ticket 06).

O gate de acesso desta rota foge do padrão simples `<ProtectedRoute
permission="canView...">` usado pelos outros módulos — depende também de
`userProfile.customRole?.board_id`, não só de uma permission string.

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

- [ ] Funcionário com cargo vinculado a um board vê, em `/board`, as colunas e
      os cards daquele board (mesmos campos genéricos: título, descrição,
      responsável, prazo, prioridade).
- [ ] Funcionário sem `board_id` no cargo e sem `canManageAllBoards` vê tela
      de acesso negado ao acessar `/board` diretamente pela URL.
- [ ] Funcionário sem `custom_role_id` nenhum vê a mesma tela de acesso
      negado.
- [ ] Nenhuma ação de escrita (criar/mover/editar/excluir card) disponível
      ainda nesta tela.
- [ ] `npm run lint` e typecheck limpos.
