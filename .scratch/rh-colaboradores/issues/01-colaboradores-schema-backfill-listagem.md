# 01 — Colaboradores: schema, backfill e listagem

**What to build:** a fundação do módulo de RH. Um administrador com a permissão de RH
acessa uma tela nova que lista todos os colaboradores (funcionários e ex-funcionários) do
laboratório, cada um mostrando se tem uma conta de usuário do sistema vinculada e o status
(ativo/desligado). Os dados vêm de um backfill automático a partir dos `user_profiles`
existentes — ninguém precisa recadastrar nada manualmente para ver a lista populada.

Ver `.scratch/rh-colaboradores/spec.md` para o desenho completo do schema e as decisões já
tomadas (departamento/cargo como texto livre, `data_admissao` NULL, etc.) — não reabrir
essas decisões sem motivo novo.

**Blocked by:** Nenhuma — pode começar imediatamente.

**Status:** ready-for-agent

- [ ] Migration cria a tabela `colaboradores` conforme o schema em `spec.md` (incluindo
      `user_profile_id` opcional com índice único parcial, `cpf` `NOT NULL UNIQUE`,
      `gestor_id` auto-referenciado, `status` com check `ativo`/`desligado`).
- [ ] Migration de backfill popula `colaboradores` a partir de todo `user_profile` com CPF
      válido (ver critério de validade abaixo): `nome`, `email`, `cpf`, `departamento`,
      `status` derivado de `is_active`/`disabled_at`/`deleted_at`, `user_profile_id`
      linkado. `cargo`, `data_admissao`, `matricula` e `gestor_id` ficam `NULL`.
- [ ] Para `user_profiles` com `deleted_at` preenchido, `nome`/`cpf`/`email`/`departamento`
      são recuperados de `deleted_snapshot` (coalesce com as colunas de topo, que ficam
      anonimizadas na exclusão) — ver `spec.md` para o `coalesce` exato. Sem isso os
      ex-funcionários somem do backfill.
- [ ] CPF é considerado válido apenas se passa na validação de dígito verificador (módulo
      11). `user_profiles` com CPF nulo ou que falha nessa validação (inclui contas
      genéricas de setor com CPF sequencial tipo `00000000001`) são identificados e
      relatados (ex.: query/relatório simples) para tratamento manual futuro — não viram
      colaborador automático e não bloqueiam a migration dos demais.
- [ ] Novo módulo de RH criado seguindo o padrão de módulo do flowlab, com permission key
      própria (ex. `canViewColaboradores`) e item no sidebar, protegido por
      `<ProtectedRoute>`.
- [ ] Tela de listagem exibe: nome, CPF, departamento, status, e se há usuário do sistema
      vinculado (com nome/e-mail da conta, quando houver).
- [ ] RLS na tabela `colaboradores` segue o padrão do projeto (`current_user_has_permission()`).
