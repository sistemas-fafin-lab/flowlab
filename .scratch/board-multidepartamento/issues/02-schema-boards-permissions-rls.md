# 02 — Schema genérico de boards + permissions + RLS + seed "Transporte"

**What to build:** a fundação de dados para boards genéricos por
departamento (spec: `.scratch/board-multidepartamento/spec.md`). Uma nova
migration Supabase criando:

- `boards`: catálogo de boards (`id`, `slug`, `label`, `created_at`).
- `custom_roles`: nova coluna `board_id` (FK nullable para `boards.id`) — um
  cargo aponta para no máximo um board; vários cargos podem apontar para o
  mesmo board.
- `board_tickets`: tabela genérica de cards (`id`, `board_id` FK, `title`,
  `description`, `responsible_id` FK `user_profiles`, `due_date`, `priority`,
  `kanban_status` — mesmo conjunto de valores do enum já usado por
  `it_requests.kanban_status`: `backlog`/`todo`/`in_progress`/`review`/`done`
  —, `created_by`, timestamps). Sem colunas específicas de departamento.
- RLS em `board_tickets`: **ver** um card do board X exige que o cargo do
  usuário tenha `board_id = X`, ou que o usuário tenha `canManageAllBoards`;
  **escrever** (insert/update/delete) exige a condição de ver **e**
  `canManageBoard`, ou `canManageAllBoards` sozinho.
- Duas permission keys novas em `ALL_PERMISSION_KEYS`
  (`src/utils/permissions.ts`), agrupadas sob "Board": `canManageBoard`
  (escrita no board do próprio cargo) e `canManageAllBoards` (leitura e
  escrita em todos os boards). Nenhuma permission nova por departamento —
  são as únicas duas, para sempre.
- Seed: uma linha em `boards` para `slug = 'transporte'`.

Não inclui: vincular os cargos de Transporte já existentes a esse board nem
marcar `canManageBoard` neles — isso é feito manualmente pelo usuário depois,
via a UI de cargos já existente (`UserManagement.tsx`), fora do escopo deste
ticket.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Migration aplicada criando `boards`, `board_tickets` e
      `custom_roles.board_id`, com a linha "transporte" semeada em `boards`.
- [ ] RLS de `board_tickets` implementa a regra de acesso descrita acima
      (verificável via query direta simulando cargos diferentes).
- [ ] `canManageBoard` e `canManageAllBoards` aparecem em
      `ALL_PERMISSION_KEYS` e ficam marcáveis na UI de administração de
      cargos (`UserManagement.tsx`) sem nenhuma mudança adicional nela.
- [ ] Confirmar (e ajustar se necessário) se `LEGACY_ROLE_PERMISSIONS` deve
      dar `canManageAllBoards` automaticamente ao role legado `admin` —
      comportamento desejado pela spec é todo admin legado enxergar todos os
      boards.
- [ ] `npm run lint` e typecheck limpos.
