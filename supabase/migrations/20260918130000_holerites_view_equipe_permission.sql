-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — Holerites: permissão somente-leitura escopada `canViewHoleritesEquipe`
-- Migration: 20260918130000_holerites_view_equipe_permission.sql
--
-- Pedido do RH: um gestor/responsável de setor precisa ver os holerites das
-- pessoas que ele gerencia, sem virar `canManageHolerites`/`canViewAllHolerites`
-- (que dão acesso GLOBAL, de todos os departamentos). O escopo usa
-- `colaboradores.gestor_id` (hierarquia já existente, com trigger anti-ciclo —
-- ver 20260914150000_rh_colaboradores.sql), não o campo de texto livre
-- `departamento`: só enxerga quem tem esse gestor como gestor DIRETO.
--
-- As policies são ADICIONADAS (permissivas, somam com OR) às já existentes —
-- nenhuma delas é alterada ou removida.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Tabela colaborador_holerites — SELECT adicional, só das linhas cujo
-- colaborador tem gestor_id = colaborador do usuário logado.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS colaborador_holerites_select_equipe ON public.colaborador_holerites;
CREATE POLICY colaborador_holerites_select_equipe ON public.colaborador_holerites
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewHoleritesEquipe')
    AND EXISTS (
      SELECT 1
      FROM public.colaboradores subordinado
      JOIN public.colaboradores gestor ON gestor.id = subordinado.gestor_id
      WHERE subordinado.id = colaborador_holerites.colaborador_id
        AND gestor.user_profile_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Storage — SELECT adicional no bucket privado (signed URL de download),
-- mesmo escopo: primeira pasta do path é o colaborador_id de um subordinado.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "colaborador_holerites_storage_select_equipe" ON storage.objects;
CREATE POLICY "colaborador_holerites_storage_select_equipe"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'colaborador-holerites'
  AND public.current_user_has_permission('canViewHoleritesEquipe')
  AND EXISTS (
    SELECT 1
    FROM public.colaboradores subordinado
    JOIN public.colaboradores gestor ON gestor.id = subordinado.gestor_id
    WHERE subordinado.id::text = (storage.foldername(name))[1]
      AND gestor.user_profile_id = auth.uid()
  )
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. colaboradores — SELECT adicional, mesmo motivo das policies anteriores: sem
-- isso o embed `colaboradores(nome)` da listagem voltaria null pra quem só tem
-- canViewHoleritesEquipe (RLS nega a tabela referenciada). Escopo: só as linhas
-- dos próprios subordinados diretos.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS colaboradores_select_holerites_equipe ON public.colaboradores;
CREATE POLICY colaboradores_select_holerites_equipe ON public.colaboradores
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewHoleritesEquipe')
    AND EXISTS (
      SELECT 1 FROM public.colaboradores gestor
      WHERE gestor.id = colaboradores.gestor_id
        AND gestor.user_profile_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Cargo de exemplo — gestor de setor (só vê a própria equipe).
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO custom_roles (name, description, permissions, is_system) VALUES
(
  'Gestor de Setor',
  'Visualiza e baixa os holerites das pessoas sob sua gestão direta (via gestor_id), sem poder enviar ou remover. Além disso, cria e visualiza solicitações do seu departamento.',
  '["canViewRequests", "canAddRequests", "canViewHoleritesEquipe"]'::jsonb,
  false
)
ON CONFLICT (name) DO NOTHING;
