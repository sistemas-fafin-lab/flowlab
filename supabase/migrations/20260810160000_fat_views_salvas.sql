-- ═══════════════════════════════════════════════════════════════════════════════
-- Views de Faturamento — filtros salvos por usuário
-- Migration: 20260810160000_fat_views_salvas.sql
--
-- Item 2 do feedback do stakeholder mapeado em
-- docs/plans/faturamento/feedback-dashboard-views-design.md: permitir salvar um
-- conjunto de filtros (Dashboard, Títulos, Glosas/Recursos) com nome, para
-- reaplicar depois. Cada tela guarda o formato de filtro que já usa hoje
-- (TitulosFiltros, DashboardReceberFiltros, ...) direto em `filtros`, sem
-- esquema fixo — quem interpreta o jsonb é sempre o cliente da tela
-- correspondente, nunca o banco.
--
-- Sem RPC de propósito: é um CRUD simples de linha própria, mesmo padrão de
-- `lancarGlosas`/`cancelarTitulo` em useContasReceber.ts (INSERT/UPDATE/DELETE
-- direto sob RLS), sem necessidade de transação.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.fat_views_salvas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Lista fechada de propósito: cada tela nova que ganhar views salvas entra
  -- aqui numa migration própria, junto do formato de filtro que ela usa.
  tela        TEXT NOT NULL CHECK (tela IN ('dashboard', 'titulos', 'glosas')),
  nome        TEXT NOT NULL CHECK (btrim(nome) <> ''),
  filtros     JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Duas views com o mesmo nome na mesma tela, do mesmo usuário, é quase
  -- sempre um clique duplo ou um "salvar" em cima do que já existia.
  UNIQUE (usuario_id, tela, nome)
);

COMMENT ON TABLE public.fat_views_salvas IS 'Conjuntos de filtros do módulo de faturamento salvos por usuário, para reaplicar depois. filtros é livre (formato definido pela tela que gravou), nunca interpretado pelo banco.';
COMMENT ON COLUMN public.fat_views_salvas.tela IS 'Tela dona do formato de `filtros`: dashboard = DashboardReceberFiltros, titulos = TitulosFiltros, glosas = filtro de GlosasRecursos.';

CREATE INDEX IF NOT EXISTS idx_fat_views_salvas_usuario_tela ON public.fat_views_salvas(usuario_id, tela);

CREATE OR REPLACE FUNCTION public.fat_views_salvas_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_fat_views_salvas_updated_at ON public.fat_views_salvas;
CREATE TRIGGER trigger_fat_views_salvas_updated_at
  BEFORE UPDATE ON public.fat_views_salvas
  FOR EACH ROW EXECUTE FUNCTION public.fat_views_salvas_set_updated_at();

-- ─── RLS — sempre a própria linha, nunca a de outro usuário ──────────────────
-- canViewBilling já basta: salvar um filtro não muda dado financeiro nenhum,
-- só a conveniência de quem já pode ver a tela.
ALTER TABLE public.fat_views_salvas ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fat_views_salvas'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.fat_views_salvas', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "fat_views_salvas_select_own" ON public.fat_views_salvas
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid()
     AND (public.current_user_has_permission('canViewBilling')
       OR public.current_user_has_permission('canManageBilling')));

CREATE POLICY "fat_views_salvas_insert_own" ON public.fat_views_salvas
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid()
     AND (public.current_user_has_permission('canViewBilling')
       OR public.current_user_has_permission('canManageBilling')));

CREATE POLICY "fat_views_salvas_update_own" ON public.fat_views_salvas
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid()
     AND (public.current_user_has_permission('canViewBilling')
       OR public.current_user_has_permission('canManageBilling')))
  WITH CHECK (usuario_id = auth.uid()
     AND (public.current_user_has_permission('canViewBilling')
       OR public.current_user_has_permission('canManageBilling')));

CREATE POLICY "fat_views_salvas_delete_own" ON public.fat_views_salvas
  FOR DELETE TO authenticated
  USING (usuario_id = auth.uid()
     AND (public.current_user_has_permission('canViewBilling')
       OR public.current_user_has_permission('canManageBilling')));
