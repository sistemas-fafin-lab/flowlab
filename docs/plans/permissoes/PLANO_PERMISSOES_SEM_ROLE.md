# Plano — Permissões só pelo cargo (fim da coluna `role` legada)

> **Status:** 🚧 código pronto, falta aplicar a migration e conferir no navegador (branch `fix/permissoes-sem-role`).
> **Issue:** `.scratch/permissoes-sem-role/issues/01-permissoes-sem-role.md`.
> **Criado em:** 16/Out/2026.

## Por quê

Pedido do usuário (15/Out): "a coluna role é legacy; o FlowLab deve consultar integralmente a tabela custom_roles".

Até aqui, `user_profiles.role` decidia acesso em três lugares:
- **Banco:** `current_user_has_permission` liberava tudo para `role = 'admin'`, seja qual fosse o cargo. Era a base de todas as policies. `user_has_permission` ainda tinha o fallback de `admin`, `operator` e `requester`, e cerca de 30 policies liam `role` direto.
- **Servidor:** as rotas de RH, Qualidade, Faturamento, Recepção, Umami, criação de usuário e EVA aceitavam `role === 'admin'` no lugar da chave.
- **Front:** o `AuthContext` usava as permissões do role quando a pessoa não tinha cargo. Várias telas (Solicitações, Pagamentos, Manutenção, TI, Cotações, Estoque Departamental, templates de e-mail) tinham o role como única regra.

Na prática: quem tinha `role = 'admin'` e trocou de cargo continuava administrador de tudo no banco e no servidor, e a tela só escondia os botões.

## Decisões do usuário (15/Out)

| # | Pergunta | Escolha |
|---|---|---|
| P1 | O cargo Administrador não tinha 16 chaves mais novas | **A migration completa o cargo** com todo o catálogo. Ela não roda se ninguém ativo ficar com Gerenciar usuários e Gerenciar cargos. |
| P2 | Telas de TI (admin ou departamento TI) | **Gerenciar TI** (`canManageIT`). |
| P3 | Solicitações, Pagamentos e Manutenção (admin ou operator) | **Uma chave por tela:** `canApproveRequests`, mais as novas `canApprovePayments` e `canManageMaintenance`. |
| P4 | Funções só do admin, sem chave | **Chaves novas:** `canManageEmailTemplates`, `canViewAllStockDepart` e `canViewAllNotifications`. |

**Decisão de implementação, na linha da P4:** decidir no lugar do gestor, excluir e aprovar sem limite em Cotações, que eram do role admin, ganharam a chave `canAdministerQuotations`.

**Quem recebe as chaves novas:**
- o cargo Administrador recebe as seis;
- o cargo "Desenvolvedor" recebe também `canViewAllNotifications`, porque a policy antiga dava esse acesso a ele pelo nome do cargo;
- os outros cargos, você marca em Cargos e Permissões.

## O que muda

**Migration** `supabase/migrations/20261015180000_perm_sem_role_legado.sql`, em uma transação:
1. **O cargo Administrador recebe todo o catálogo** (`ALL_PERMISSION_KEYS`). O teste `src/utils/permissions.test.ts` confere que as duas listas batem.
2. **Trava:** sem ninguém ativo com as duas chaves de administração pelo cargo, a migration aborta e nada muda.
3. **Alçadas de cotação:**
   - quem aprovava pelo padrão do role (admin = nível 4, operator = nível 1) e não tinha linha em `user_approval_limits` ganha a linha equivalente, com uma nota;
   - depois disso, sem linha, não aprova (`get_user_approval_limit`).
4. **Funções sem o role:**
   - `current_user_has_permission` e `user_has_permission` (este sem o fallback);
   - as funções da EVA;
   - `deactivate_user` e `soft_delete_user`: a trava do "último admin" vira "a última pessoa ativa com Gerenciar cargos" (`perm_ultimo_que_gerencia_cargos`);
   - `quotation_record_manager_decision`, que passa a pedir `canAdministerQuotations`.
5. **Views:**
   - `user_approval_limits_with_details` troca `user_role` por `role_name` (o cargo) e deixa de ser lida pelo anon (ela tem e-mails);
   - `user_roles_view` perde `legacy_role`.
6. **Policies:** 32 trocadas pela chave do cargo:
   - cargos: `canManageRoles`;
   - manutenção: `canManageMaintenance`;
   - alçadas e categorias do menu: `canManageUsers`;
   - TI (chamados, projetos, sprints, visões): `canManageIT`;
   - notificações de todos: `canViewAllNotifications`;
   - templates de e-mail: `canManageEmailTemplates`;
   - itens de cotação: `canManageRoles`, a mesma chave de antes, sem o admin;
   - dias de exceção da agenda: `canManageAnalisesClinicas`.
7. **Segurança:** a policy "Allow users to update their own profile" deixava qualquer pessoa trocar o próprio cargo, departamento ou e-mail pela API. O trigger `perm_protege_perfil` passa a exigir Gerenciar cargos para isso.

**Servidor:**
- `api/_lib/*/autorizacao.ts`, `recepcaoAgendamento`, `uploadDocumentoRecepcao`, `documentosCheckin`, `umamiAuth` e `createUser` aceitam só a chave do cargo;
- a EVA perde o `ehAdmin`;
- `createUser` não grava mais `role` (o default do banco basta).

**Front:**
- `AuthContext`: as permissões são só as do cargo; sem cargo, nenhuma. Saíram `updateUserRole`, `getPermissionsForLegacyRole`, `getRoleLabel`, `getRoleForDepartment`, `DEPARTMENT_ROLES` e o tipo `UserRole`. `UserProfile` não tem mais `role`.
- Solicitações, Pagamentos, Manutenção, TI (Kanban e Mind Map), Estoque Departamental, templates de e-mail e Cotações passam a pedir as chaves acima.
- Usuários: o filtro é por cargo, e o ícone e a cor dizem o que o cargo permite.

**Fica como está:**
- a coluna `role` continua na tabela, só não é lida;
- os tipos gerados em `src/lib/database.types.ts`;
- as cópias antigas em `docs/standalone-modules/`;
- o script `supabase/scripts/prod-upgrade-user-soft-delete.sql`.

## Como aplicar sem impacto para os usuários

O código só lê o cargo. Para ninguém perceber a mudança, cada pessoa precisa ter **no cargo**, no momento da troca, o acesso que hoje vem do role. É um ajuste de dados, feito antes.

1. **Prévia (só leitura):** rode `supabase/scripts/perm_sem_role_previa_impacto.sql` no SQL Editor do projeto do app. Cada linha é uma pessoa ativa que vai perder ou ganhar algo:
   - o que vinha do role `admin` e o cargo não tem (por chave);
   - o que vinha do role `operator`: Pagamentos, Manutenção, os dias de exceção da agenda, ver e criar cotações;
   - o que vinha do departamento TI;
   - quem está sem cargo;
   - o que o cargo Administrador passa a dar a quem já está nele;
   - o que as decisões abrem a mais: apagar itens de TI com Gerenciar TI, editar alçadas com Gerenciar Usuários.
2. **Ajuste, linha por linha:**
   - perda que você quer, como quem você já tirou de admin: deixe;
   - perda que não deve acontecer: coloque a pessoa no cargo certo (ex.: Administrador) ou acrescente as chaves ao cargo dela. As chaves novas já podem ser gravadas antes do deploy:
     ```sql
     UPDATE custom_roles SET permissions = permissions || '["canApprovePayments","canManageMaintenance"]'::jsonb
      WHERE name = 'Operador';
     ```
     Acrescentar a um cargo vale para todos que estão nele. Se só uma parte deve receber, crie outro cargo para essa parte;
   - sem cargo: dê um cargo à pessoa.
3. **Repita a prévia** até sobrar só o que você quer que mude.
4. **Cópia de segurança** (num schema que a API não expõe):
   ```sql
   CREATE SCHEMA IF NOT EXISTS backup;
   CREATE TABLE backup.custom_roles_20261016 AS SELECT * FROM public.custom_roles;
   CREATE TABLE backup.user_approval_limits_20261016 AS SELECT * FROM public.user_approval_limits;
   ```
5. **Aplique a migration e faça o merge logo em seguida, nessa ordem.**
   - Entre os dois, o código antigo ainda aceita o role. Com a prévia limpa, isso não muda nada para ninguém.
   - Ao contrário (código novo antes da migration), quem é admin perderia na tela as chaves que o cargo Administrador ainda não tem.
6. **Depois do deploy,** as pessoas veem as telas novas quando recarregarem o FlowLab. Confira com um administrador e um operador.
