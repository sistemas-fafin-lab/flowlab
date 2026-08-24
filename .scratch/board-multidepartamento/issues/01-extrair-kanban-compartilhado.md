# 01 — Extrair componente de Kanban compartilhado

**What to build:** hoje a UI de colunas + drag-and-drop do board de TI vive
embutida em `ITKanbanBoard.tsx`, específica de TI. Extrair essa parte (render
de colunas, cards, movimentação entre colunas) para um componente
apresentacional reutilizável, parametrizado por colunas/cards/callbacks de
movimentação — sem nenhuma lógica de dados/Supabase dentro dele.
`ITKanbanBoard.tsx` passa a consumir esse componente compartilhado para o
board de TI. É a única peça de código de fato compartilhada entre o board de
TI e os futuros boards genéricos por departamento (spec:
`.scratch/board-multidepartamento/spec.md`) — dados e regras de acesso
continuam completamente separados.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Existe um componente de Kanban compartilhado, sem imports de Supabase e
      sem conhecimento de "TI" — recebe colunas/cards/callbacks via props.
- [ ] `ITKanbanBoard.tsx` consome esse componente compartilhado.
- [ ] O board de TI funciona exatamente como antes (mesmas colunas, mesmo
      drag-and-drop, mesmo comportamento visual) — regressão zero, verificado
      manualmente na tela `/it/kanban`.
- [ ] `npm run lint` e typecheck limpos.
