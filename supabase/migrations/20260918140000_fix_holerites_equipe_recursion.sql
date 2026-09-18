-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — Holerites: corrige recursão infinita em `colaboradores_select_holerites_equipe`
-- Migration: 20260918140000_fix_holerites_equipe_recursion.sql
--
-- Bug: a policy de SELECT em `colaboradores` (20260918130000) faz um EXISTS que
-- consulta a própria `colaboradores` (subordinado/gestor). Uma policy que
-- referencia a mesma tabela em que está definida dispara
-- "infinite recursion detected in policy for relation \"colaboradores\"" —
-- quebra QUALQUER select em colaboradores, pra qualquer usuário (não só
-- gestores), inclusive o autoatendimento de holerites (useMeusHolerites).
--
-- Fix: extrai a checagem pra uma função SECURITY DEFINER (mesmo padrão de
-- `current_user_has_permission`, ver 20260618010000: "bypassa RLS, evita
-- recursão") e reaponta as 3 policies de 20260918130000 pra usá-la, ao invés
-- de fazer o self-join direto dentro da própria policy de `colaboradores`.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Função SECURITY DEFINER — true se o colaborador informado tem como
-- gestor DIRETO o colaborador vinculado ao usuário autenticado atual.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.colaborador_e_subordinado_do_usuario_atual(p_colaborador_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.colaboradores subordinado
    JOIN public.colaboradores gestor ON gestor.id = subordinado.gestor_id
    WHERE subordinado.id = p_colaborador_id
      AND gestor.user_profile_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.colaborador_e_subordinado_do_usuario_atual(uuid) IS 'SECURITY DEFINER — evita recursão de RLS em colaboradores (ver 20260918140000). True se p_colaborador_id tem como gestor direto o colaborador do usuário logado.';

REVOKE ALL ON FUNCTION public.colaborador_e_subordinado_do_usuario_atual(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.colaborador_e_subordinado_do_usuario_atual(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. colaboradores — recria a policy sem self-join direto.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS colaboradores_select_holerites_equipe ON public.colaboradores;
CREATE POLICY colaboradores_select_holerites_equipe ON public.colaboradores
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewHoleritesEquipe')
    AND public.colaborador_e_subordinado_do_usuario_atual(colaboradores.id)
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. colaborador_holerites — mesma troca (não tinha recursão, já que a policy
-- está em outra tabela, mas centraliza a regra numa função só).
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS colaborador_holerites_select_equipe ON public.colaborador_holerites;
CREATE POLICY colaborador_holerites_select_equipe ON public.colaborador_holerites
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewHoleritesEquipe')
    AND public.colaborador_e_subordinado_do_usuario_atual(colaborador_holerites.colaborador_id)
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. storage.objects — idem.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "colaborador_holerites_storage_select_equipe" ON storage.objects;
CREATE POLICY "colaborador_holerites_storage_select_equipe"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'colaborador-holerites'
  AND public.current_user_has_permission('canViewHoleritesEquipe')
  AND public.colaborador_e_subordinado_do_usuario_atual(((storage.foldername(name))[1])::uuid)
);
