# 03 — Lógica de resolução de acesso ao board (`resolveBoardAccess`)

**What to build:** o seam único de teste da spec
(`.scratch/board-multidepartamento/spec.md`) — uma função pura em
`src/modules/board/domain/` que recebe o cargo do usuário logado (permissions
+ `board_id`) e devolve o que ele pode ver/fazer: qual board (se algum) ele
enxerga, e se pode só visualizar ou também gerenciar (criar/editar/mover/
excluir cards). Sem tocar Supabase ou React — pura lógica de decisão,
seguindo o padrão já usado em `src/modules/qualidade/domain/*` e
`src/utils/permissions.test.ts`.

Regra a implementar: cargo com `board_id` preenchido → pode ver aquele board;
cargo com `board_id` e permission `canManageBoard` → pode também gerenciar;
usuário com `canManageAllBoards` → vê e gerencia todos os boards,
independente do cargo; usuário sem `board_id` e sem `canManageAllBoards` →
sem acesso a nenhum board; usuário sem `custom_role_id` → sem acesso.

**Blocked by:** None — can start immediately (o formato de dados já está
decidido na spec; não depende da migration estar aplicada)

**Status:** ready-for-agent

- [ ] Função pura implementada em `domain/`, sem imports de Supabase/React.
- [ ] Teste co-localizado cobrindo: sem `board_id` (sem acesso); com
      `board_id` sem `canManageBoard` (view only); com `board_id` e
      `canManageBoard` (view + manage); com `canManageAllBoards` (acesso
      total a todos os boards, independente do cargo); sem `custom_role_id`
      (sem acesso).
- [ ] `npm run lint`, typecheck e testes limpos.
