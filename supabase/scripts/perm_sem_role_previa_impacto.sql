-- ═══════════════════════════════════════════════════════════════════════════════
-- Prévia de impacto de 20261015180000_perm_sem_role_legado.sql — SÓ LEITURA
--
-- Rode no SQL Editor do projeto do app ANTES de aplicar a migration. Cada linha é uma
-- pessoa ativa que vai perder ou ganhar algo quando o role legado deixar de valer.
-- Para não haver impacto, ajuste cargos (ou mova pessoas de cargo) e rode de novo até
-- sobrar só o que você quer que mude (por exemplo, quem você já tirou de admin).
--
-- Colunas: pessoa, e-mail, role legado, cargo, mudança (perde/ganha), o quê.
-- Considera o que a migration faz: o cargo Administrador recebe todo o catálogo; o cargo
-- "Desenvolvedor" recebe Ver notificações de todos; a aba Permissões da EVA (ti_agente_papeis)
-- vale no lugar do cargo nas três chaves da EVA. Alçadas de cotação não aparecem: a
-- migration grava as que vinham do role, então ninguém perde.
-- ═══════════════════════════════════════════════════════════════════════════════

WITH
catalogo AS (
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
  ]) AS k
),
cargo_admin AS (
  SELECT id FROM public.custom_roles
   WHERE id = 'a0000000-0000-0000-0000-000000000001' OR (is_system AND name = 'Administrador')
),
p AS (
  SELECT u.id, u.name, u.email, u.role, u.department,
         cr.id AS cargo_id, cr.name AS cargo,
         COALESCE(cr.permissions, '[]'::jsonb) AS antes,
         CASE
           WHEN cr.id IN (SELECT id FROM cargo_admin) THEN (SELECT jsonb_agg(k) FROM catalogo)
           WHEN cr.name = 'Desenvolvedor' THEN COALESCE(cr.permissions, '[]'::jsonb) || '["canViewAllNotifications"]'::jsonb
           ELSE COALESCE(cr.permissions, '[]'::jsonb)
         END AS depois,
         tp.user_id IS NOT NULL AS tem_linha_eva, tp.configura, tp.gestor, tp.aprova
    FROM public.user_profiles u
    LEFT JOIN public.custom_roles cr ON cr.id = u.custom_role_id
    LEFT JOIN public.ti_agente_papeis tp ON tp.user_id = u.id
   WHERE u.deleted_at IS NULL AND u.disabled_at IS NULL
),
-- Cada chave, hoje e depois. Hoje, o role admin passa em todas (banco e servidor); nas três
-- da EVA, a aba Permissões vale no lugar do cargo (exceto para o admin, que tinha as três).
chaves AS (
  SELECT p.id, c.k,
         CASE
           WHEN p.role = 'admin' THEN true
           -- Hoje o cargo "Desenvolvedor" já lê as notificações de todos, pelo nome do cargo.
           WHEN c.k = 'canViewAllNotifications' AND p.cargo = 'Desenvolvedor' THEN true
           WHEN p.tem_linha_eva AND c.k = 'canConfigureAgenteTI' THEN p.configura
           WHEN p.tem_linha_eva AND c.k = 'canManageAgenteTI' THEN p.gestor
           WHEN p.tem_linha_eva AND c.k = 'canApproveAgenteTI' THEN p.aprova
           ELSE p.antes ? c.k
         END AS hoje,
         CASE
           WHEN p.tem_linha_eva AND c.k = 'canConfigureAgenteTI' THEN p.configura
           WHEN p.tem_linha_eva AND c.k = 'canManageAgenteTI' THEN p.gestor
           WHEN p.tem_linha_eva AND c.k = 'canApproveAgenteTI' THEN p.aprova
           ELSE p.depois ? c.k
         END AS depois
    FROM p CROSS JOIN catalogo c
),
-- Funcionalidades que hoje dependem do role ou do departamento, e não de uma chave.
-- (O admin já aparece pelas chaves acima: hoje ele tem todas.)
func AS (
  SELECT p.id, f.o_que, f.hoje, f.depois
    FROM p
    CROSS JOIN LATERAL (VALUES
      ('Solicitações: aprovar, iniciar cotação, finalizar e ver todos os setores (Aprovar Solicitações)',
        p.role = 'operator', p.depois ? 'canApproveRequests'),
      ('Pagamentos: aprovar, marcar como pago, excluir e ver todos os setores (Aprovar Pagamentos)',
        p.role = 'operator', p.depois ? 'canApprovePayments'),
      ('Manutenção: ver todas, iniciar, concluir e itens de estoque (Gerenciar Manutenção)',
        p.role = 'operator', p.depois ? 'canManageMaintenance'),
      ('Análises Clínicas: editar dias de exceção da agenda (Gerenciar Postos e Horários)',
        p.role = 'operator', p.depois ? 'canManageAnalisesClinicas'),
      ('Cotações: ver e criar',
        p.role = 'operator' OR p.antes ?| ARRAY['canViewQuotations', 'canCreateQuotations', 'canManageQuotations'],
        p.depois ?| ARRAY['canViewQuotations', 'canCreateQuotations', 'canManageQuotations']),
      ('TI: editar chamados, projetos, sprints e visões pela API (Gerenciar TI)',
        p.department = 'TI', p.depois ? 'canManageIT'),
      ('TI: apagar chamados, projetos, sprints e visões (Gerenciar TI)',
        false, p.depois ? 'canManageIT'),
      ('TI: botão Gerir Projetos e editar o Mind Map (Gerenciar TI)',
        p.department = 'TI', p.depois ? 'canManageIT'),
      ('Usuários: editar alçadas de aprovação (Gerenciar Usuários)',
        false, p.depois ? 'canManageUsers')
    ) AS f(o_que, hoje, depois)
   WHERE p.role <> 'admin'
)
SELECT nome, email, role_legado, cargo, mudanca, o_que
  FROM (
    -- Sem cargo: hoje a tela usa as permissões do role; depois, nenhuma.
    SELECT p.name AS nome, p.email, p.role AS role_legado, '(sem cargo)' AS cargo, 'perde' AS mudanca,
           'Tudo: sem cargo, a pessoa fica sem permissão nenhuma (hoje a tela usa as do role ' || p.role || ')' AS o_que, 0 AS ordem
      FROM p WHERE p.cargo_id IS NULL
    UNION ALL
    SELECT p.name, p.email, p.role, COALESCE(p.cargo, '(sem cargo)'),
           CASE WHEN ch.hoje THEN 'perde' ELSE 'ganha' END,
           string_agg(ch.k, ', ' ORDER BY ch.k), 1
      FROM chaves ch JOIN p ON p.id = ch.id
     WHERE ch.hoje IS DISTINCT FROM ch.depois AND p.cargo_id IS NOT NULL
     GROUP BY p.name, p.email, p.role, p.cargo, ch.hoje
    UNION ALL
    SELECT p.name, p.email, p.role, COALESCE(p.cargo, '(sem cargo)'),
           CASE WHEN fu.hoje THEN 'perde' ELSE 'ganha' END, fu.o_que, 2
      FROM func fu JOIN p ON p.id = fu.id
     WHERE fu.hoje IS DISTINCT FROM fu.depois AND p.cargo_id IS NOT NULL
  ) r
 ORDER BY nome, ordem, mudanca DESC, o_que;
