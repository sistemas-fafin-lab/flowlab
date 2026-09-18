-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — Holerites: permissão somente-leitura `canViewAllHolerites`
-- Migration: 20260918120000_holerites_view_all_permission.sql
--
-- Até aqui, ver a lista completa de holerites (todos os colaboradores) exigia
-- `canManageHolerites`, que também dá poder de enviar/remover. Esta migration
-- adiciona uma permissão só-leitura para quem deve enxergar tudo sem poder
-- mexer. As policies são ADICIONADAS (permissivas, somam com OR) às já
-- existentes de `canManageHolerites` — nenhuma delas é alterada ou removida.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Tabela colaborador_holerites — SELECT adicional (sem INSERT/UPDATE/DELETE).
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS colaborador_holerites_select_view_all ON public.colaborador_holerites;
CREATE POLICY colaborador_holerites_select_view_all ON public.colaborador_holerites
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewAllHolerites'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Storage — SELECT adicional no bucket privado, pra permitir a signed URL de
-- download (sem upload/remoção).
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "colaborador_holerites_storage_select_view_all" ON storage.objects;
CREATE POLICY "colaborador_holerites_storage_select_view_all"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'colaborador-holerites' AND public.current_user_has_permission('canViewAllHolerites'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. colaboradores — SELECT adicional, mesmo motivo da policy
-- `colaboradores_select_holerites_manage` (20260916120000): sem isso, o embed
-- `colaboradores(nome)` da listagem voltaria null pra quem só tem
-- canViewAllHolerites (RLS nega a tabela referenciada).
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS colaboradores_select_holerites_view_all ON public.colaboradores;
CREATE POLICY colaboradores_select_holerites_view_all ON public.colaboradores
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewAllHolerites'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Cargo de exemplo — RH em modo consulta (só vê, não gerencia).
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO custom_roles (name, description, permissions, is_system) VALUES
(
  'RH - Consulta',
  'Visualiza e baixa todos os holerites, sem poder enviar ou remover. Além disso, cria e visualiza solicitações do seu departamento.',
  '["canViewRequests", "canAddRequests", "canViewAllHolerites"]'::jsonb,
  false
)
ON CONFLICT (name) DO NOTHING;
