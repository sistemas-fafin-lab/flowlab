# 01 — Permissões só pelo cargo: o FlowLab para de ler `user_profiles.role`

**What to build:** o usuário viu, na aba Permissões da EVA, pessoas marcadas como "Administrador" que ele já tinha trocado de cargo. A causa: a coluna legada `role` (`admin`/`operator`/`requester`) ainda valia no banco, no servidor e no front, por cima do cargo. Pedido (15/Out): "a coluna role é legacy; o FlowLab deve consultar integralmente a tabela custom_roles".

Decisões e detalhes: `docs/plans/permissoes/PLANO_PERMISSOES_SEM_ROLE.md`.

**Blocked by:** nada.

**Status:** done (16/Out/2026): migration aplicada, merge no `main` (PR #14) e deploy no ar; falta a conferência no navegador

- [x] Migration `20261015180000_perm_sem_role_legado.sql`:
  - cargo Administrador com todo o catálogo;
  - trava de "ninguém administrando";
  - alçadas explícitas;
  - funções, views e 32 policies pela chave do cargo;
  - trigger contra se promover pela API.
- [x] Seis chaves novas no catálogo: `canApprovePayments`, `canManageMaintenance`, `canManageEmailTemplates`, `canViewAllStockDepart`, `canViewAllNotifications`, `canAdministerQuotations`.
- [x] Servidor: oito autorizações sem `role === 'admin'`; a EVA sem `ehAdmin`; `createUser` sem gravar `role`.
- [x] Front:
  - `AuthContext` só com o cargo;
  - `UserProfile` sem `role`;
  - os helpers legados saíram;
  - Solicitações, Pagamentos, Manutenção, TI, Estoque, templates e Cotações pelas chaves;
  - Usuários filtra por cargo.
- [x] Testes:
  - PGlite: 55 cenários (`testar-perm-sem-role.mjs`, fora do repositório);
  - vitest: o cargo Administrador da migration = o catálogo; a EVA sem admin.
- [x] Prévia de impacto, só leitura: `supabase/scripts/perm_sem_role_previa_impacto.sql`. Testada no PGlite em 12 cenários; depois dos ajustes, ela bate com a migration aplicada.
- [ ] Rodar a prévia no projeto do app e ajustar cargos até sobrar só o que deve mudar (procedimento no plano, "Como aplicar sem impacto").
- [ ] Cópia de segurança de `custom_roles` e `user_approval_limits` (schema `backup`).
- [x] Aplicar a migration e, logo em seguida, fazer o merge.
- [ ] Conferir no navegador:
  - um ex-admin com outro cargo não vê mais o que o cargo não dá;
  - o cargo Administrador vê tudo;
  - a aba Permissões da EVA não mostra mais "Administrador".

## Comments

**16/Out/2026 — implementado no código.**
- **Inventário:** três varreduras em paralelo (banco, servidor e front) acharam:
  - 14 funções, 3 views e 30 policies que liam `role`;
  - 12 leituras no servidor;
  - cerca de 75 no front.
- **Achado de segurança:** "Allow users to update their own profile" (20250616124417) não restringe colunas. Pela API, qualquer pessoa logada podia trocar o próprio `custom_role_id`, `role` ou `department`. O trigger `perm_protege_perfil` fecha isso para a escrita direta do cliente. Policies, RPCs SECURITY DEFINER e o servidor seguem funcionando.
- **Testes:**
  - PGlite: 55 cenários, incluindo a migration recusada sem administrador, a reaplicação, as alçadas, a trava do último que gerencia cargos, o trigger e as policies de TI, manutenção, templates, cargos e agenda;
  - vitest: 1468.
- **Tipos e lint:**
  - `tsc`: nenhum erro novo no front (os 25 do MindMap já existiam) e nenhum nas 11 entradas da API;
  - ESLint: nenhuma mensagem nas linhas alteradas.

**16/Out/2026 — aplicada e publicada.**
- O usuário aplicou a migration no projeto do app (`jqxe…`) e fez o merge (PR #14).
- Conferência só com a chave pública, sem ler nem gravar dados:
  - `perm_ultimo_que_gerencia_cargos` existe e o anon é barrado;
  - as duas views foram recriadas e o anon não as lê mais;
  - as funções da EVA e das alçadas continuam existindo.
- Deploy em produção (`flow-lab.vercel.app`):
  - o bundle já traz as chaves novas;
  - a API responde 401 sem token.
