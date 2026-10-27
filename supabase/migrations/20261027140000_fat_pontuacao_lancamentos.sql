-- ═══════════════════════════════════════════════════════════════════════════════
-- Lançamentos manuais da Pontuação do setor (.scratch/faturamento-pontuacao/,
-- issue 05): os pontos que a coordenação digita nos critérios que dependem de
-- avaliação, com observação obrigatória. Um lançamento por mês, Frente e
-- critério; lançar de novo substitui o anterior (upsert) e o trigger grava
-- quem alterou e quando.
--
-- As chaves manuais por Frente espelham CRITERIOS em
-- api/_lib/faturamento/pontuacaoSetor.ts.
--
-- Recusar escrita em mês fechado fica para a issue 06 (fechamentos).
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.fat_pontuacao_lancamentos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano               INTEGER NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  mes               INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  frente            TEXT NOT NULL CHECK (frente IN ('faturamento', 'recursoGlosa')),
  chave             TEXT NOT NULL,
  pontos            NUMERIC(5, 1) NOT NULL CHECK (pontos >= 0),
  observacao        TEXT NOT NULL CHECK (btrim(observacao) <> ''),
  lancado_por       UUID REFERENCES auth.users(id),
  lancado_por_nome  TEXT,
  lancado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ano, mes, frente, chave),
  CHECK (
    (frente = 'faturamento' AND chave IN ('dominioPops', 'melhoriaSetor'))
    OR (frente = 'recursoGlosa' AND chave IN ('intrasetorial', 'dominioPops', 'melhoriaSetor', 'refaturamento', 'reversaoGlosa', 'destravarRecursos'))
  )
);

COMMENT ON TABLE public.fat_pontuacao_lancamentos IS 'Lançamentos manuais da Pontuação do setor (Faturamento → Indicadores): pontos e observação por mês, Frente e critério manual, com quem lançou ou alterou por último.';

-- SECURITY DEFINER: o nome vem de user_profiles, que a RLS pode esconder de
-- quem lança. Grava sempre o usuário da sessão, nunca o que vier no corpo.
CREATE OR REPLACE FUNCTION public.fat_pontuacao_lancamentos_set_autoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.lancado_por = auth.uid();
  NEW.lancado_por_nome = (SELECT COALESCE(NULLIF(btrim(up.name), ''), up.email) FROM public.user_profiles up WHERE up.id = auth.uid());
  NEW.lancado_em = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_fat_pontuacao_lancamentos_autoria ON public.fat_pontuacao_lancamentos;
CREATE TRIGGER trigger_fat_pontuacao_lancamentos_autoria
  BEFORE INSERT OR UPDATE ON public.fat_pontuacao_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.fat_pontuacao_lancamentos_set_autoria();

-- ─── RLS — mesmo padrão de fat_pontuacao_membros: canViewBilling lê,
-- canManageBilling grava. Sem policy de DELETE: corrigir é lançar de novo.
ALTER TABLE public.fat_pontuacao_lancamentos ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fat_pontuacao_lancamentos'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.fat_pontuacao_lancamentos', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "fat_pontuacao_lancamentos_select_billing" ON public.fat_pontuacao_lancamentos
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewBilling')
      OR public.current_user_has_permission('canManageBilling'));

CREATE POLICY "fat_pontuacao_lancamentos_insert_billing" ON public.fat_pontuacao_lancamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageBilling'));

CREATE POLICY "fat_pontuacao_lancamentos_update_billing" ON public.fat_pontuacao_lancamentos
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageBilling'))
  WITH CHECK (public.current_user_has_permission('canManageBilling'));
