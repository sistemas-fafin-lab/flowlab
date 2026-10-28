-- ═══════════════════════════════════════════════════════════════════════════════
-- Pontos base editáveis da Pontuação do setor (.scratch/faturamento-pontuacao/).
-- A spec deixava os pontos base só no código; a coordenação pediu para ajustá-los
-- na tela (28/10/2026). Uma linha por Frente e critério, só para os ajustados:
-- critério sem linha usa o padrão de CRITERIOS em
-- api/_lib/faturamento/pontuacaoSetor.ts. O valor vale para a prévia de todo mês
-- aberto; o Fechamento congela o que valia ao fechar.
--
-- As chaves por Frente espelham CRITERIOS (manuais e automáticos).
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.fat_pontuacao_pontos_base (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frente             TEXT NOT NULL CHECK (frente IN ('faturamento', 'recursoGlosa')),
  chave              TEXT NOT NULL,
  pontos_base        NUMERIC(5, 1) NOT NULL CHECK (pontos_base >= 0),
  alterado_por       UUID REFERENCES auth.users(id),
  alterado_por_nome  TEXT,
  alterado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (frente, chave),
  CHECK (
    (frente = 'faturamento' AND chave IN ('guiasSemLote', 'tarefasPendentes', 'dominioPops', 'melhoriaSetor', 'metaMensal', 'zeroGlosa', 'metaSuperada'))
    OR (frente = 'recursoGlosa' AND chave IN ('intrasetorial', 'tarefasPendentes', 'dominioPops', 'melhoriaSetor', 'refaturamento', 'reversaoGlosa', 'destravarRecursos'))
  )
);

COMMENT ON TABLE public.fat_pontuacao_pontos_base IS 'Pontos base ajustados na tela da Pontuação do setor (Faturamento → Indicadores), por Frente e critério. Critério sem linha usa o padrão do código. Vale para os meses abertos; o Fechamento congela o valor.';

-- SECURITY DEFINER: o nome vem de user_profiles, que a RLS pode esconder de
-- quem altera. Grava sempre o usuário da sessão, nunca o que vier no corpo.
CREATE OR REPLACE FUNCTION public.fat_pontuacao_pontos_base_set_autoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.alterado_por = auth.uid();
  NEW.alterado_por_nome = (SELECT COALESCE(NULLIF(btrim(up.name), ''), up.email) FROM public.user_profiles up WHERE up.id = auth.uid());
  NEW.alterado_em = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_fat_pontuacao_pontos_base_autoria ON public.fat_pontuacao_pontos_base;
CREATE TRIGGER trigger_fat_pontuacao_pontos_base_autoria
  BEFORE INSERT OR UPDATE ON public.fat_pontuacao_pontos_base
  FOR EACH ROW EXECUTE FUNCTION public.fat_pontuacao_pontos_base_set_autoria();

-- ─── RLS — mesmo padrão de fat_pontuacao_lancamentos: canViewBilling lê,
-- canManageBilling grava. Sem policy de DELETE: voltar ao padrão é gravar o
-- valor padrão.
ALTER TABLE public.fat_pontuacao_pontos_base ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fat_pontuacao_pontos_base'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.fat_pontuacao_pontos_base', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "fat_pontuacao_pontos_base_select_billing" ON public.fat_pontuacao_pontos_base
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewBilling')
      OR public.current_user_has_permission('canManageBilling'));

CREATE POLICY "fat_pontuacao_pontos_base_insert_billing" ON public.fat_pontuacao_pontos_base
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageBilling'));

CREATE POLICY "fat_pontuacao_pontos_base_update_billing" ON public.fat_pontuacao_pontos_base
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageBilling'))
  WITH CHECK (public.current_user_has_permission('canManageBilling'));
