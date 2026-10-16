-- ═══════════════════════════════════════════════════════════════════════════════
-- Permissões só pelo cargo: o banco para de ler user_profiles.role
-- Migration: 20261015180000_perm_sem_role_legado.sql
-- (.scratch/permissoes-sem-role/issues/01-permissoes-sem-role.md)
--
-- Pedido do usuário (15/Out): "a coluna role é legacy; o FlowLab deve consultar
-- integralmente a tabela custom_roles". Até aqui, role = 'admin' liberava tudo no banco e
-- no servidor, seja qual fosse o cargo; e role 'admin'/'operator' era a única regra de
-- várias telas e policies.
--
-- O que muda:
--   1. O cargo Administrador recebe todas as permissões do catálogo (src/utils/permissions.ts),
--      inclusive as seis novas desta migration. Antes, o role 'admin' cobria as que faltavam.
--   2. Trava: a migration não roda se nenhuma pessoa ativa ficar com Gerenciar usuários e
--      Gerenciar cargos pelo cargo (ninguém conseguiria mais administrar o FlowLab).
--   3. Alçadas de cotação: quem hoje aprova pelo padrão do role (admin = nível 4,
--      operator = nível 1) e não tem linha em user_approval_limits ganha a linha
--      equivalente, visível e editável em Usuários. Depois disso, sem linha = não aprova.
--   4. Funções, views e policies param de ler role e passam a pedir uma chave do cargo.
--   5. Ninguém altera o próprio cargo, departamento, e-mail, CPF ou situação pela API:
--      a policy "Allow users to update their own profile" deixava (trigger novo).
--
-- Chaves novas (o cargo Administrador recebe; nos outros, marque em Cargos e Permissões):
--   canApprovePayments       Aprovar pagamentos (antes: role admin/operator)
--   canManageMaintenance     Gerenciar manutenção (antes: role admin/operator; excluir, só admin)
--   canManageEmailTemplates  Gerenciar templates de e-mail (antes: role admin)
--   canViewAllStockDepart    Ver estoque de todos os setores (antes: role admin)
--   canViewAllNotifications  Ver notificações de todos (antes: role admin ou o cargo
--                            "Desenvolvedor", que também recebe a chave para não perder o acesso)
--   canAdministerQuotations  Administrar cotações: excluir, decidir no lugar do gestor e
--                            aprovar sem limite (antes: role admin)
--
-- A coluna role continua na tabela (NOT NULL DEFAULT 'requester'), só não é lida.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. CARGO ADMINISTRADOR COM TODAS AS PERMISSÕES
-- ═══════════════════════════════════════════════════════════════════════════════

-- A lista é o catálogo ALL_PERMISSION_KEYS de src/utils/permissions.ts (o teste
-- src/utils/permissions.test.ts confere que as duas batem).
UPDATE public.custom_roles cr
   SET permissions = (
         SELECT jsonb_agg(DISTINCT k ORDER BY k)
           FROM (
             SELECT jsonb_array_elements_text(cr.permissions) AS k
             UNION
             SELECT unnest(ARRAY[
               'canViewDashboard',
               'canManageProducts', 'canViewProducts', 'canAddProducts', 'canEditProducts', 'canDeleteProducts',
               'canViewMovements', 'canAddMovements',
               'canViewStockDepart', 'canConsumeStockDepart', 'canManageStockPostos', 'canAddStockDepart', 'canViewAllStockDepart',
               'canViewRequests', 'canAddRequests', 'canApproveRequests', 'canApprovePayments', 'canManageMaintenance',
               'canViewExpiration', 'canViewChangelog',
               'canManageUsers', 'canDeleteUsers', 'canManageSuppliers', 'canManageQuotations', 'canConfigureRequestPeriods',
               'canViewBilling', 'canManageBilling', 'canManageRoles', 'canManageEmailTemplates', 'canViewAllNotifications',
               'canManageIT', 'canViewGastosTI', 'canManageGastosTI',
               'canConfigureAgenteTI', 'canManageAgenteTI', 'canApproveAgenteTI',
               'canManageWhitelist',
               'canViewAnalisesClinicas', 'canManageAnalisesClinicas', 'canManageColetas', 'canDeleteAgendamentos',
               'canEditarAgendamentos', 'canCorrigirIdentidade', 'canViewTemperatura',
               'canViewQuotations', 'canCreateQuotations', 'canAdvanceQuotation', 'canRevertQuotation',
               'canSelectWinnerQuotation', 'canSubmitForApproval', 'canConvertQuotation', 'canCancelQuotation',
               'canAdministerQuotations',
               'canUseWhatsapp',
               'canViewQualidade', 'canManageQualidade',
               'canManageBoard', 'canManageAllBoards',
               'canViewColaboradores', 'canManageHolerites', 'canViewAllHolerites', 'canViewHoleritesEquipe'
             ])
           ) t
       ),
       updated_at = now()
 WHERE cr.id = 'a0000000-0000-0000-0000-000000000001'
    OR (cr.is_system AND cr.name = 'Administrador');

-- Quem lia todas as notificações pelo nome do cargo continua lendo, agora pela chave.
UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canViewAllNotifications"]'::jsonb,
       updated_at = now()
 WHERE cr.name = 'Desenvolvedor'
   AND NOT cr.permissions ? 'canViewAllNotifications';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. TRAVA: ALGUÉM PRECISA CONTINUAR ADMINISTRANDO
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.user_profiles p
      JOIN public.custom_roles cr ON cr.id = p.custom_role_id
     WHERE p.deleted_at IS NULL
       AND p.disabled_at IS NULL
       AND cr.permissions ?& ARRAY['canManageUsers', 'canManageRoles']
  ) THEN
    RAISE EXCEPTION 'Nenhuma pessoa ativa tem um cargo com Gerenciar usuários e Gerenciar cargos. Coloque alguém no cargo Administrador antes de aplicar esta migration: sem o role legado, ninguém conseguiria mais administrar o FlowLab.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. ALÇADAS DE COTAÇÃO: O PADRÃO DO ROLE VIRA LINHA EXPLÍCITA
-- ═══════════════════════════════════════════════════════════════════════════════

-- A última leitura do role: quem aprova hoje pelo padrão dele continua aprovando, agora
-- por uma linha que aparece e se edita em Usuários. Mesmos níveis de get_user_approval_limit.
INSERT INTO public.user_approval_limits (user_id, approval_level, can_approve, notes)
SELECT p.id,
       CASE p.role WHEN 'admin' THEN 'level_4' ELSE 'level_1' END,
       TRUE,
       'Alçada que vinha do papel legado (' || p.role || '); gravada em 20261015180000_perm_sem_role_legado.'
  FROM public.user_profiles p
 WHERE p.deleted_at IS NULL
   AND p.role IN ('admin', 'operator')
ON CONFLICT (user_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. FUNÇÕES
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Permissão de quem está logado: só o cargo ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_has_permission(p_permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles p
    JOIN custom_roles cr ON cr.id = p.custom_role_id
    WHERE p.id = auth.uid()
      AND p.deleted_at IS NULL
      AND p.disabled_at IS NULL
      AND cr.permissions @> to_jsonb(ARRAY[p_permission])
  );
END;
$$;

COMMENT ON FUNCTION public.current_user_has_permission(text) IS 'O cargo (custom_roles.permissions) de quem está logado tem a chave. Removido ou desativado, não. Desde 20261015180000, o role legado não conta.';

-- ─── Permissão de um usuário dado: só o cargo, sem o fallback legado ──────────
-- Os nomes dos parâmetros (user_id, permission_key) ficam: CREATE OR REPLACE não renomeia,
-- e as policies de quotation_items dependiam desta função.
CREATE OR REPLACE FUNCTION public.user_has_permission(user_id UUID, permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles up
    JOIN custom_roles cr ON cr.id = up.custom_role_id
    WHERE up.id = user_has_permission.user_id
      AND up.deleted_at IS NULL
      AND up.disabled_at IS NULL
      AND cr.permissions ? permission_key
  );
END;
$$;

COMMENT ON FUNCTION public.user_has_permission(uuid, text) IS 'O cargo do usuário tem a chave. Desde 20261015180000, sem o fallback do role legado (admin, operator, requester).';

-- ─── EVA: as três chaves pelo cargo ou pela aba Permissões, sem o admin ───────
CREATE OR REPLACE FUNCTION public.ti_agente_tem_permissao(p_user uuid, p_chave text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user IS NOT NULL AND p_chave IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.user_profiles p
      LEFT JOIN public.custom_roles cr ON cr.id = p.custom_role_id
      LEFT JOIN public.ti_agente_papeis tp ON tp.user_id = p.id
     WHERE p.id = p_user
       AND p.deleted_at IS NULL
       AND p.disabled_at IS NULL
       AND CASE
             WHEN tp.user_id IS NOT NULL AND p_chave = 'canConfigureAgenteTI' THEN tp.configura
             WHEN tp.user_id IS NOT NULL AND p_chave = 'canManageAgenteTI' THEN tp.gestor
             WHEN tp.user_id IS NOT NULL AND p_chave = 'canApproveAgenteTI' THEN tp.aprova
             ELSE COALESCE(cr.permissions @> to_jsonb(ARRAY[p_chave]), false)
           END
  );
$$;

COMMENT ON FUNCTION public.ti_agente_tem_permissao(uuid, text) IS 'A permissão de um usuário dado: nas três chaves da EVA, a linha de ti_agente_papeis quando existe (D33); senão, o cargo. Removido ou desativado, não. Desde 20261015180000, sem o role legado.';

CREATE OR REPLACE FUNCTION public.ti_agente_definir_papeis(p_user uuid, p_configura boolean, p_gestor boolean, p_aprova boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_at timestamptz;
BEGIN
  IF NOT public.ti_agente_pode('canConfigureAgenteTI') THEN
    RAISE EXCEPTION 'Só quem configura a EVA muda as permissões dela.' USING ERRCODE = '42501';
  END IF;
  IF p_configura IS NULL OR p_gestor IS NULL OR p_aprova IS NULL THEN
    RAISE EXCEPTION 'Informe as três permissões.' USING ERRCODE = '22023';
  END IF;

  SELECT deleted_at INTO v_deleted_at FROM public.user_profiles WHERE id = p_user;
  IF NOT FOUND OR v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF p_user = auth.uid() AND NOT p_configura THEN
    RAISE EXCEPTION 'Você não pode tirar a sua própria permissão de configurar a EVA.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ti_agente_papeis (user_id, configura, gestor, aprova, updated_by)
  VALUES (p_user, p_configura, p_gestor, p_aprova, auth.uid())
  ON CONFLICT (user_id) DO UPDATE
    SET configura = EXCLUDED.configura, gestor = EXCLUDED.gestor, aprova = EXCLUDED.aprova;
END;
$$;

COMMENT ON FUNCTION public.ti_agente_definir_papeis(uuid, boolean, boolean, boolean) IS 'Define as três permissões da EVA de uma pessoa, no lugar do cargo (D33). Só quem configura; ninguém tira a própria permissão de configurar.';

CREATE OR REPLACE FUNCTION public.ti_agente_voltar_ao_cargo(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.ti_agente_pode('canConfigureAgenteTI') THEN
    RAISE EXCEPTION 'Só quem configura a EVA muda as permissões dela.' USING ERRCODE = '42501';
  END IF;
  -- Voltar ao cargo não pode tirar de quem pede o acesso a esta tela.
  IF p_user = auth.uid() AND NOT EXISTS (
    SELECT 1
      FROM public.user_profiles p
      JOIN public.custom_roles cr ON cr.id = p.custom_role_id
     WHERE p.id = p_user
       AND cr.permissions @> to_jsonb(ARRAY['canConfigureAgenteTI'])
  ) THEN
    RAISE EXCEPTION 'Pelo seu cargo você não configura a EVA: voltar ao cargo tiraria o seu acesso a esta tela.' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.ti_agente_papeis WHERE user_id = p_user;
END;
$$;

-- ─── Quem gerencia cargos: o último ativo não sai ──────────────────────────────
-- Substitui a trava do "último administrador" (role = 'admin') de deactivate_user e
-- soft_delete_user: o que não pode acabar é quem consegue dar permissões.
CREATE OR REPLACE FUNCTION public.perm_ultimo_que_gerencia_cargos(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
           SELECT 1
             FROM user_profiles p
             JOIN custom_roles cr ON cr.id = p.custom_role_id
            WHERE p.id = p_user_id
              AND cr.permissions ? 'canManageRoles'
         )
     AND (
           SELECT count(*)
             FROM user_profiles p
             JOIN custom_roles cr ON cr.id = p.custom_role_id
            WHERE cr.permissions ? 'canManageRoles'
              AND p.deleted_at IS NULL
              AND p.disabled_at IS NULL
         ) <= 1;
$$;

COMMENT ON FUNCTION public.perm_ultimo_que_gerencia_cargos(uuid) IS 'A pessoa é a última ativa com Gerenciar cargos: desativá-la ou removê-la deixaria o FlowLab sem quem dá permissões.';

REVOKE ALL ON FUNCTION public.perm_ultimo_que_gerencia_cargos(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.deactivate_user(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
BEGIN
  PERFORM public.assert_can_manage_users();

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode desativar o próprio usuário.';
  END IF;

  SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado: %', p_user_id;
  END IF;

  IF v_profile.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário % foi removido — use restore_user() antes de desativá-lo.', p_user_id;
  END IF;

  IF v_profile.disabled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário % já está desativado desde %.', p_user_id, v_profile.disabled_at;
  END IF;

  IF public.perm_ultimo_que_gerencia_cargos(p_user_id) THEN
    RAISE EXCEPTION 'Esta é a última pessoa ativa com a permissão Gerenciar cargos. Dê essa permissão a outra pessoa antes de desativá-la.';
  END IF;

  UPDATE auth.users
     SET banned_until = 'infinity'::timestamptz,
         updated_at   = NOW()
   WHERE id = p_user_id;

  -- Revoga acessos já emitidos (o JWT atual continuaria válido até expirar)
  DELETE FROM auth.sessions       WHERE user_id = p_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;

  UPDATE user_profiles
     SET disabled_at = NOW(),
         updated_at  = NOW()
   WHERE id = p_user_id;

  RETURN format('Usuário desativado: %s <%s>. O login foi bloqueado; reative quando quiser.', v_profile.name, v_profile.email);
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_user(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile     user_profiles%ROWTYPE;
  v_auth        auth.users%ROWTYPE;
  v_dummy_email TEXT;
  v_snapshot    JSONB;
BEGIN
  PERFORM public.assert_can_delete_users();

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode remover o próprio usuário.';
  END IF;

  SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado: %', p_user_id;
  END IF;

  IF v_profile.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário % já foi removido em %.', p_user_id, v_profile.deleted_at;
  END IF;

  -- Não deixar o sistema sem quem dá permissões
  IF public.perm_ultimo_que_gerencia_cargos(p_user_id) THEN
    RAISE EXCEPTION 'Esta é a última pessoa ativa com a permissão Gerenciar cargos. Dê essa permissão a outra pessoa antes de removê-la.';
  END IF;

  SELECT * INTO v_auth FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não existe em auth.users: %', p_user_id;
  END IF;

  v_dummy_email := 'deleted_' || p_user_id || '@deleted.flowlab.local';

  v_snapshot := (to_jsonb(v_profile) - 'deleted_snapshot' - 'is_active' - 'deleted_at')
    || jsonb_build_object(
         'profile_email',      v_profile.email,
         'auth_email',         v_auth.email,
         'email_confirmed_at', v_auth.email_confirmed_at,
         'raw_user_meta_data', v_auth.raw_user_meta_data,
         'raw_app_meta_data',  v_auth.raw_app_meta_data,
         'deleted_by',         auth.uid(),
         'deleted_at',         NOW()
       );

  UPDATE auth.users
     SET email                      = v_dummy_email,
         encrypted_password         = '',
         email_confirmed_at         = NULL,
         banned_until               = 'infinity'::timestamptz,
         phone                      = NULL,
         phone_confirmed_at         = NULL,
         confirmation_token         = '',
         recovery_token             = '',
         reauthentication_token     = '',
         email_change               = '',
         email_change_token_new     = '',
         email_change_token_current = '',
         is_super_admin             = FALSE,
         raw_user_meta_data         = jsonb_build_object('deleted', true, 'deleted_at', NOW()),
         raw_app_meta_data          = COALESCE(raw_app_meta_data, '{}'::jsonb)
                                      || jsonb_build_object('deleted', true),
         updated_at                 = NOW()
   WHERE id = p_user_id;

  UPDATE auth.identities
     SET identity_data = identity_data || jsonb_build_object('email', v_dummy_email),
         updated_at    = NOW()
   WHERE user_id = p_user_id;

  DELETE FROM auth.sessions       WHERE user_id = p_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;

  UPDATE user_profiles
     SET email            = v_dummy_email,
         name             = 'Usuário Removido',
         department       = NULL,
         cpf              = NULL,
         custom_role_id   = NULL,
         deleted_at       = NOW(),
         deleted_snapshot = v_snapshot,
         updated_at       = NOW()
   WHERE id = p_user_id;

  IF v_profile.cpf IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM user_profiles
        WHERE cpf = v_profile.cpf AND id <> p_user_id AND deleted_at IS NULL
     )
  THEN
    UPDATE user_whitelist
       SET activity = FALSE, updated_at = NOW()
     WHERE cpf = v_profile.cpf;
  END IF;

  DELETE FROM user_notifications   WHERE user_id = p_user_id;
  DELETE FROM user_approval_limits WHERE user_id = p_user_id;

  RETURN format(
    'Usuário removido: %s <%s>. UUID %s preservado; chamados, projetos, aprovações e comentários mantidos. Restaure com: SELECT restore_user(''%s'');',
    v_snapshot ->> 'name', v_snapshot ->> 'auth_email', p_user_id, p_user_id
  );
END;
$$;

-- ─── Alçada de cotação: só a linha de user_approval_limits ────────────────────
-- Sem linha, não aprova. Quem aprovava pelo padrão do role ganhou a linha na seção 3.
CREATE OR REPLACE FUNCTION public.get_user_approval_limit(p_user_id UUID)
RETURNS TABLE (
  approval_level VARCHAR(20),
  max_amount DECIMAL(15, 2),
  can_approve BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ual.approval_level,
    COALESCE(ual.custom_max_amount, alc.max_amount) as max_amount,
    ual.can_approve
  FROM user_approval_limits ual
  LEFT JOIN approval_level_config alc ON alc.level = ual.approval_level
  WHERE ual.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'none'::VARCHAR(20), 0.00::DECIMAL(15, 2), FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_approval_limit(uuid) IS 'A alçada de cotação do usuário (user_approval_limits); sem linha, não aprova. Desde 20261015180000, sem o padrão do role legado.';

-- ─── Cotações: decidir no lugar do gestor pede canAdministerQuotations ───────
-- Corpo igual ao de 20261007150000; só v_is_admin muda (antes: role = 'admin').
CREATE OR REPLACE FUNCTION public.quotation_record_manager_decision(
  p_quotation_id   UUID,
  p_decision       VARCHAR(20),
  p_level          VARCHAR(20),
  p_approver_id    UUID,
  p_approver_name  VARCHAR(255),
  p_approver_role  VARCHAR(50),
  p_max_amount     DECIMAL(15, 2),
  p_comment        TEXT,
  p_decided_at     TIMESTAMPTZ,
  p_signature_hash VARCHAR(64)
)
RETURNS TABLE (
  approval_id               UUID,
  approval_created_at       TIMESTAMPTZ,
  new_status                TEXT,
  decided_by_admin          BOOLEAN,
  waived_approval_id        UUID,
  waived_approval_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin         BOOLEAN;
  v_is_manager       BOOLEAN;
  v_found            BOOLEAN;
  v_manager_id       UUID;
  v_status           TEXT;
  v_final_total      DECIMAL(15, 2);
  v_estimated_total  DECIMAL(15, 2);
  v_real_amount      DECIMAL(15, 2);
  v_can_approve      BOOLEAN;
  v_limit            DECIMAL(15, 2);
  v_new_status       TEXT;
  v_approval         quotation_approvals;
  v_waived           quotation_approvals;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_approver_id <> auth.uid() THEN
    RAISE EXCEPTION 'p_approver_id não corresponde ao usuário autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decisão inválida: %.', p_decision;
  END IF;

  IF p_level NOT IN ('level_1', 'level_2', 'level_3', 'level_4') THEN
    RAISE EXCEPTION 'Nível de alçada inválido: %.', p_level;
  END IF;

  IF p_decision = 'rejected' AND NULLIF(btrim(COALESCE(p_comment, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da rejeição.' USING ERRCODE = '22023';
  END IF;

  v_is_admin := public.current_user_has_permission('canAdministerQuotations');

  SELECT requester_manager_id, status, final_total_amount, estimated_total
    INTO v_manager_id, v_status, v_final_total, v_estimated_total
    FROM quotations WHERE id = p_quotation_id FOR UPDATE;

  v_found := FOUND;
  -- IS NOT DISTINCT FROM: cotação sem gestor (NULL) nunca autoriza um
  -- não-admin — com "=" o NULL atravessaria o IF NOT (...) abaixo.
  v_is_manager := v_found AND v_manager_id IS NOT DISTINCT FROM auth.uid();

  IF NOT (v_is_manager OR v_is_admin) THEN
    RAISE EXCEPTION 'Somente o gestor do pedido (ou quem administra cotações) pode decidir esta etapa da cotação.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT v_found THEN
    RAISE EXCEPTION 'Cotação não encontrada.';
  END IF;

  IF v_status <> 'awaiting_manager_approval' THEN
    RAISE EXCEPTION 'Cotação não está aguardando aprovação do gestor (status atual: %).', v_status;
  END IF;

  -- Valor real no momento da decisão, já refletindo uma troca de vencedora
  -- feita no próprio modal — é contra ele que a alçada é checada abaixo.
  v_real_amount := COALESCE(v_final_total, v_estimated_total, 0);
  IF p_max_amount IS DISTINCT FROM v_real_amount THEN
    RAISE EXCEPTION 'Valor informado (%) não corresponde ao valor atual da cotação (%). Atualize a página e tente novamente.',
      p_max_amount, v_real_amount USING ERRCODE = '22023';
  END IF;

  INSERT INTO quotation_approvals (
    quotation_id, level, approver_id, approver_name, approver_role,
    status, max_amount, comment, approved_at, rejected_at, signature_hash
  ) VALUES (
    p_quotation_id, 'manager', p_approver_id, p_approver_name, p_approver_role,
    p_decision, p_max_amount, p_comment,
    CASE WHEN p_decision = 'approved' THEN p_decided_at END,
    CASE WHEN p_decision = 'rejected' THEN p_decided_at END,
    CASE WHEN p_decision = 'approved' THEN p_signature_hash END
  )
  ON CONFLICT (quotation_id, level) DO UPDATE SET
    approver_id    = EXCLUDED.approver_id,
    approver_name  = EXCLUDED.approver_name,
    approver_role  = EXCLUDED.approver_role,
    status         = EXCLUDED.status,
    max_amount     = EXCLUDED.max_amount,
    comment        = EXCLUDED.comment,
    approved_at    = EXCLUDED.approved_at,
    rejected_at    = EXCLUDED.rejected_at,
    signature_hash = EXCLUDED.signature_hash
  RETURNING * INTO v_approval;

  IF p_decision = 'rejected' THEN
    v_new_status := 'under_review';
  ELSE
    SELECT can_approve, max_amount INTO v_can_approve, v_limit
      FROM get_user_approval_limit(auth.uid())
     LIMIT 1;

    IF COALESCE(v_can_approve, FALSE) AND v_real_amount <= COALESCE(v_limit, 0) THEN
      -- Etapa 2 dispensada: a aprovação do gestor vale também pela alçada.
      INSERT INTO quotation_approvals (
        quotation_id, level, approver_id, approver_name, approver_role,
        status, max_amount, comment, approved_at, rejected_at, signature_hash,
        stage_waived
      ) VALUES (
        p_quotation_id, p_level, p_approver_id, p_approver_name, p_approver_role,
        'approved', p_max_amount, p_comment, p_decided_at, NULL, p_signature_hash,
        TRUE
      )
      ON CONFLICT (quotation_id, level) DO UPDATE SET
        approver_id    = EXCLUDED.approver_id,
        approver_name  = EXCLUDED.approver_name,
        approver_role  = EXCLUDED.approver_role,
        status         = EXCLUDED.status,
        max_amount     = EXCLUDED.max_amount,
        comment        = EXCLUDED.comment,
        approved_at    = EXCLUDED.approved_at,
        rejected_at    = EXCLUDED.rejected_at,
        signature_hash = EXCLUDED.signature_hash,
        stage_waived   = EXCLUDED.stage_waived
      RETURNING * INTO v_waived;

      v_new_status := 'approved';
    ELSE
      v_new_status := 'awaiting_approval';
    END IF;
  END IF;

  UPDATE quotations SET status = v_new_status WHERE id = p_quotation_id;

  RETURN QUERY SELECT v_approval.id, v_approval.created_at, v_new_status, NOT v_is_manager,
    v_waived.id, v_waived.created_at;
END;
$$;

COMMENT ON FUNCTION public.quotation_record_manager_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR)
  IS 'Etapa do gestor do pedido: rejeita com comentário obrigatório (→ under_review) ou aprova — se a alçada do aprovador cobre o valor real, grava também a linha de alçada p_level (stage_waived, mesma assinatura e instante) e vai para approved; senão vai para awaiting_approval. Só o requester_manager_id da cotação ou quem tem canAdministerQuotations; valida p_max_amount contra COALESCE(final_total_amount, estimated_total, 0). decided_by_admin = decidido por quem administra cotações, no lugar do gestor.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. VIEWS SEM O ROLE
-- ═══════════════════════════════════════════════════════════════════════════════

-- user_role (o role legado) sai; entra role_name, o nome do cargo. Ninguém lia user_role.
DROP VIEW IF EXISTS public.user_approval_limits_with_details;
CREATE VIEW public.user_approval_limits_with_details AS
SELECT
  ual.id,
  ual.user_id,
  up.name as user_name,
  up.email as user_email,
  cr.name as role_name,
  up.department,
  ual.approval_level,
  alc.label as level_label,
  alc.max_amount as level_max_amount,
  ual.custom_max_amount,
  COALESCE(ual.custom_max_amount, alc.max_amount) as effective_max_amount,
  ual.can_approve,
  ual.notes,
  ual.created_at,
  ual.updated_at
FROM user_approval_limits ual
JOIN user_profiles up ON up.id = ual.user_id
LEFT JOIN custom_roles cr ON cr.id = up.custom_role_id
LEFT JOIN approval_level_config alc ON alc.level = ual.approval_level;

DROP VIEW IF EXISTS public.user_roles_view;
CREATE VIEW public.user_roles_view AS
SELECT
  up.id AS user_id,
  up.email,
  up.name AS user_name,
  up.department,
  up.custom_role_id,
  cr.name AS role_name,
  cr.description AS role_description,
  cr.permissions,
  cr.is_system
FROM user_profiles up
LEFT JOIN custom_roles cr ON cr.id = up.custom_role_id;

REVOKE ALL ON public.user_approval_limits_with_details, public.user_roles_view FROM anon;
GRANT SELECT ON public.user_approval_limits_with_details, public.user_roles_view TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT ON public.user_approval_limits_with_details, public.user_roles_view TO service_role;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. POLICIES SEM O ROLE
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Cargos: Gerenciar cargos ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "custom_roles_insert_admin" ON public.custom_roles;
CREATE POLICY "custom_roles_insert_admin" ON public.custom_roles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_user_has_permission('canManageRoles')));

DROP POLICY IF EXISTS "custom_roles_update_admin" ON public.custom_roles;
CREATE POLICY "custom_roles_update_admin" ON public.custom_roles
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageRoles')))
  WITH CHECK ((SELECT public.current_user_has_permission('canManageRoles')));

DROP POLICY IF EXISTS "custom_roles_delete_admin" ON public.custom_roles;
CREATE POLICY "custom_roles_delete_admin" ON public.custom_roles
  FOR DELETE TO authenticated
  USING (is_system = false AND (SELECT public.current_user_has_permission('canManageRoles')));

-- ─── Manutenção: Gerenciar manutenção ──────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Users can view own maintenance requests" ON public.maintenance_requests
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR (SELECT public.current_user_has_permission('canManageMaintenance')));

DROP POLICY IF EXISTS "Users can update maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Users can update maintenance requests" ON public.maintenance_requests
  FOR UPDATE TO authenticated
  USING ((requester_id = auth.uid() AND status = 'pending') OR (SELECT public.current_user_has_permission('canManageMaintenance')));

DROP POLICY IF EXISTS "Admins can delete maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Admins can delete maintenance requests" ON public.maintenance_requests
  FOR DELETE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageMaintenance')));

DROP POLICY IF EXISTS "Admins and operators can create maintenance inventory items" ON public.maintenance_inventory_items;
CREATE POLICY "Admins and operators can create maintenance inventory items" ON public.maintenance_inventory_items
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_user_has_permission('canManageMaintenance')));

DROP POLICY IF EXISTS "Admins and operators can update maintenance inventory items" ON public.maintenance_inventory_items;
CREATE POLICY "Admins and operators can update maintenance inventory items" ON public.maintenance_inventory_items
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageMaintenance')));

DROP POLICY IF EXISTS "Admins can delete maintenance inventory items" ON public.maintenance_inventory_items;
CREATE POLICY "Admins can delete maintenance inventory items" ON public.maintenance_inventory_items
  FOR DELETE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageMaintenance')));

-- ─── Alçadas: Gerenciar usuários (a tela de Usuários é quem edita) ────────────
DROP POLICY IF EXISTS "approval_level_config_update" ON public.approval_level_config;
CREATE POLICY "approval_level_config_update" ON public.approval_level_config
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageUsers')));

DROP POLICY IF EXISTS "user_approval_limits_insert" ON public.user_approval_limits;
CREATE POLICY "user_approval_limits_insert" ON public.user_approval_limits
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_user_has_permission('canManageUsers')));

DROP POLICY IF EXISTS "user_approval_limits_update" ON public.user_approval_limits;
CREATE POLICY "user_approval_limits_update" ON public.user_approval_limits
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageUsers')));

DROP POLICY IF EXISTS "user_approval_limits_delete" ON public.user_approval_limits;
CREATE POLICY "user_approval_limits_delete" ON public.user_approval_limits
  FOR DELETE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageUsers')));

-- ─── Categorias do menu: Gerenciar usuários (já era a chave, ao lado do admin) ─
DROP POLICY IF EXISTS "module_categories_admin_write" ON public.module_categories;
CREATE POLICY "module_categories_admin_write" ON public.module_categories
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageUsers')))
  WITH CHECK ((SELECT public.current_user_has_permission('canManageUsers')));

-- ─── TI: Gerenciar TI (antes: role admin ou departamento TI) ───────────────────
DROP POLICY IF EXISTS "it_requests_update_it_team" ON public.it_requests;
CREATE POLICY "it_requests_update_it_team" ON public.it_requests
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageIT')))
  WITH CHECK ((SELECT public.current_user_has_permission('canManageIT')));

DROP POLICY IF EXISTS "it_requests_delete_admin" ON public.it_requests;
CREATE POLICY "it_requests_delete_admin" ON public.it_requests
  FOR DELETE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageIT')));

DROP POLICY IF EXISTS "it_projects_update_it_team" ON public.it_projects;
CREATE POLICY "it_projects_update_it_team" ON public.it_projects
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageIT')))
  WITH CHECK ((SELECT public.current_user_has_permission('canManageIT')));

DROP POLICY IF EXISTS "it_projects_delete_admin" ON public.it_projects;
CREATE POLICY "it_projects_delete_admin" ON public.it_projects
  FOR DELETE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageIT')));

DROP POLICY IF EXISTS "it_sprints_insert_it_team" ON public.it_sprints;
CREATE POLICY "it_sprints_insert_it_team" ON public.it_sprints
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_user_has_permission('canManageIT')));

DROP POLICY IF EXISTS "it_sprints_update_it_team" ON public.it_sprints;
CREATE POLICY "it_sprints_update_it_team" ON public.it_sprints
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageIT')))
  WITH CHECK ((SELECT public.current_user_has_permission('canManageIT')));

DROP POLICY IF EXISTS "it_sprints_delete_admin" ON public.it_sprints;
CREATE POLICY "it_sprints_delete_admin" ON public.it_sprints
  FOR DELETE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageIT')));

DROP POLICY IF EXISTS "it_project_visions_insert_authorized" ON public.it_project_visions;
CREATE POLICY "it_project_visions_insert_authorized" ON public.it_project_visions
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_user_has_permission('canManageIT')));

DROP POLICY IF EXISTS "it_project_visions_update_authorized" ON public.it_project_visions;
CREATE POLICY "it_project_visions_update_authorized" ON public.it_project_visions
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageIT')))
  WITH CHECK ((SELECT public.current_user_has_permission('canManageIT')));

DROP POLICY IF EXISTS "it_project_visions_delete_admin" ON public.it_project_visions;
CREATE POLICY "it_project_visions_delete_admin" ON public.it_project_visions
  FOR DELETE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageIT')));

-- ─── Notificações de todos: Ver notificações de todos ──────────────────────────
DROP POLICY IF EXISTS "user_notifications_admin_select" ON public.user_notifications;
CREATE POLICY "user_notifications_admin_select" ON public.user_notifications
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_has_permission('canViewAllNotifications')));

-- ─── Templates de e-mail: Gerenciar templates de e-mail ────────────────────────
DROP POLICY IF EXISTS "notification_templates_admin_insert" ON public.notification_templates;
CREATE POLICY "notification_templates_admin_insert" ON public.notification_templates
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_user_has_permission('canManageEmailTemplates')));

DROP POLICY IF EXISTS "notification_templates_admin_update" ON public.notification_templates;
CREATE POLICY "notification_templates_admin_update" ON public.notification_templates
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageEmailTemplates')))
  WITH CHECK ((SELECT public.current_user_has_permission('canManageEmailTemplates')));

DROP POLICY IF EXISTS "notification_templates_admin_delete" ON public.notification_templates;
CREATE POLICY "notification_templates_admin_delete" ON public.notification_templates
  FOR DELETE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageEmailTemplates')));

-- ─── Itens de cotação: a mesma chave de antes, sem o admin (Gerenciar cargos) ─
DROP POLICY IF EXISTS "quotation_items_insert" ON public.quotation_items;
CREATE POLICY "quotation_items_insert" ON public.quotation_items
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_user_has_permission('canManageRoles')));

DROP POLICY IF EXISTS "quotation_items_update" ON public.quotation_items;
CREATE POLICY "quotation_items_update" ON public.quotation_items
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageRoles')))
  WITH CHECK ((SELECT public.current_user_has_permission('canManageRoles')));

DROP POLICY IF EXISTS "quotation_items_delete" ON public.quotation_items;
CREATE POLICY "quotation_items_delete" ON public.quotation_items
  FOR DELETE TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageRoles')));

-- ─── Análises Clínicas: dias de exceção da agenda, como os postos (20260717120000) ─
DROP POLICY IF EXISTS "ac_dias_excecao_mutate_staff" ON public.ac_dias_excecao;
CREATE POLICY "ac_dias_excecao_mutate_staff" ON public.ac_dias_excecao
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_has_permission('canManageAnalisesClinicas')))
  WITH CHECK ((SELECT public.current_user_has_permission('canManageAnalisesClinicas')));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. NINGUÉM SE PROMOVE PELA API
-- ═══════════════════════════════════════════════════════════════════════════════

-- A policy "Allow users to update their own profile" (20250616124417) não restringe colunas:
-- qualquer pessoa logada podia trocar o próprio cargo, departamento ou e-mail pela API.
-- O app só grava esses campos pela tela de Usuários (Gerenciar cargos), pelas RPCs
-- SECURITY DEFINER e pelo servidor (service_role); a trava vale só para a escrita direta
-- do cliente. SECURITY INVOKER de propósito: current_user precisa ser quem escreve.
CREATE OR REPLACE FUNCTION public.perm_protege_perfil()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF (NEW.custom_role_id   IS DISTINCT FROM OLD.custom_role_id
      OR NEW.role             IS DISTINCT FROM OLD.role
      OR NEW.department       IS DISTINCT FROM OLD.department
      OR NEW.email            IS DISTINCT FROM OLD.email
      OR NEW.cpf              IS DISTINCT FROM OLD.cpf
      OR NEW.deleted_at       IS DISTINCT FROM OLD.deleted_at
      OR NEW.deleted_snapshot IS DISTINCT FROM OLD.deleted_snapshot
      OR NEW.disabled_at      IS DISTINCT FROM OLD.disabled_at)
     AND NOT public.current_user_has_permission('canManageRoles')
  THEN
    RAISE EXCEPTION 'Sem permissão para alterar cargo, departamento, e-mail, CPF ou situação de um usuário.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.perm_protege_perfil() IS 'BEFORE UPDATE em user_profiles: pela API (role authenticated), só quem tem Gerenciar cargos altera cargo, departamento, e-mail, CPF ou situação. RPCs SECURITY DEFINER e o servidor passam.';

DROP TRIGGER IF EXISTS trigger_perm_protege_perfil ON public.user_profiles;
CREATE TRIGGER trigger_perm_protege_perfil
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.perm_protege_perfil();

COMMIT;
