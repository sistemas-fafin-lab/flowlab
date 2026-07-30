-- Migration: sincronizar cargos de sistema e atribuir custom_role_id
--
-- Problema: na aba Usuários, trocar o cargo de um usuário não salvava (revertia ao anterior).
-- Causa: a política RLS "Allow admins to update any profile" (20260528120000) usa
-- current_user_has_permission('canManageUsers'), que só reconhece permissões via custom_role_id.
-- Muitos admins têm custom_role_id = NULL (o cadastro grava só a coluna 'role'), então a função
-- retorna false e o UPDATE em outros perfis afeta 0 linhas, sem erro (falha silenciosa).
--
-- Solução: preencher custom_role_id com base na role legada e alinhar as permissões dos 3 cargos
-- de sistema com LEGACY_ROLE_PERMISSIONS (src/utils/permissions.ts). Admins passam a ter o cargo
-- Administrador (com canManageUsers), restaurando a edição de cargos.

-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Sincronizar permissões dos 3 cargos de sistema com o frontend             ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- Administrador → todas as 29 permissões
UPDATE custom_roles
SET permissions = '["canViewDashboard","canManageProducts","canViewProducts","canAddProducts","canEditProducts","canDeleteProducts","canViewMovements","canAddMovements","canViewRequests","canAddRequests","canApproveRequests","canViewExpiration","canViewChangelog","canManageUsers","canManageSuppliers","canManageQuotations","canConfigureRequestPeriods","canViewBilling","canManageRoles","canManageIT","canManageWhitelist","canViewQuotations","canCreateQuotations","canAdvanceQuotation","canRevertQuotation","canSelectWinnerQuotation","canSubmitForApproval","canConvertQuotation","canCancelQuotation"]'::jsonb
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- Operador → todas exceto canViewDashboard, canManageUsers, canManageRoles, canManageIT
UPDATE custom_roles
SET permissions = '["canManageProducts","canViewProducts","canAddProducts","canEditProducts","canDeleteProducts","canViewMovements","canAddMovements","canViewRequests","canAddRequests","canApproveRequests","canViewExpiration","canViewChangelog","canManageSuppliers","canManageQuotations","canConfigureRequestPeriods","canViewBilling","canManageWhitelist","canViewQuotations","canCreateQuotations","canAdvanceQuotation","canRevertQuotation","canSelectWinnerQuotation","canSubmitForApproval","canConvertQuotation","canCancelQuotation"]'::jsonb
WHERE id = 'a0000000-0000-0000-0000-000000000002';

-- Solicitante → apenas visualizar e criar solicitações
UPDATE custom_roles
SET permissions = '["canViewRequests","canAddRequests"]'::jsonb
WHERE id = 'a0000000-0000-0000-0000-000000000003';

-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Atribuir custom_role_id aos usuários com base na role legada               ║
-- ║    (apenas os que ainda estão sem cargo, preservando atribuições manuais)     ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

UPDATE user_profiles
SET custom_role_id = CASE role
  WHEN 'admin'     THEN 'a0000000-0000-0000-0000-000000000001'::uuid
  WHEN 'operator'  THEN 'a0000000-0000-0000-0000-000000000002'::uuid
  WHEN 'requester' THEN 'a0000000-0000-0000-0000-000000000003'::uuid
END
WHERE custom_role_id IS NULL
  AND role IN ('admin','operator','requester');
