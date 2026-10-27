-- ═══════════════════════════════════════════════════════════════════════════════
-- Fechamento da Pontuação do setor (.scratch/faturamento-pontuacao/, issue 06):
-- congela o mês com o resumo inteiro em JSON (fatos, membros, lançamentos e
-- pontos), o "dados até" do backup do apLIS usado e quem fechou e quando.
--
-- Reabrir não apaga: preenche reaberto_* e o fechamento sai de vigor. O mês
-- pode ser fechado de novo, então a unicidade de (ano, mes) vale só entre os
-- fechamentos em vigor (índice parcial).
--
-- Mês fechado não aceita lançamento manual: o trigger em
-- fat_pontuacao_lancamentos recusa com SQLSTATE PT409, que o PostgREST devolve
-- como HTTP 409. O trigger vale para qualquer papel, inclusive SQL direto.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
  IF to_regclass('public.fat_pontuacao_lancamentos') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.fat_pontuacao_lancamentos não existe. Aplique 20261027140000_fat_pontuacao_lancamentos.sql antes desta migration.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.fat_pontuacao_fechamentos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano                INTEGER NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  mes                INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  resumo             JSONB NOT NULL,
  dado_ate           TIMESTAMP NOT NULL,
  fechado_por        UUID REFERENCES auth.users(id),
  fechado_por_nome   TEXT,
  fechado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reaberto_por       UUID REFERENCES auth.users(id),
  reaberto_por_nome  TEXT,
  reaberto_em        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS fat_pontuacao_fechamentos_em_vigor
  ON public.fat_pontuacao_fechamentos (ano, mes)
  WHERE reaberto_em IS NULL;

COMMENT ON TABLE public.fat_pontuacao_fechamentos IS 'Fechamentos da Pontuação do setor (Faturamento → Indicadores): o resumo congelado do mês, com quem fechou e, se reaberto, quem reabriu. Em vigor = reaberto_em nulo.';

-- SECURITY DEFINER: o nome vem de user_profiles, que a RLS pode esconder.
-- Grava sempre o usuário da sessão. Fechamento é imutável: o UPDATE só serve
-- para reabrir, uma vez, e não mexe no que foi congelado.
CREATE OR REPLACE FUNCTION public.fat_pontuacao_fechamentos_set_autoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome TEXT := (SELECT COALESCE(NULLIF(btrim(up.name), ''), up.email) FROM public.user_profiles up WHERE up.id = auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.fechado_por = auth.uid();
    NEW.fechado_por_nome = v_nome;
    NEW.fechado_em = NOW();
    NEW.reaberto_por = NULL;
    NEW.reaberto_por_nome = NULL;
    NEW.reaberto_em = NULL;
    RETURN NEW;
  END IF;

  IF OLD.reaberto_em IS NOT NULL THEN
    RAISE EXCEPTION 'Este fechamento já foi reaberto.' USING ERRCODE = 'PT409';
  END IF;
  IF NEW.reaberto_em IS NULL
     OR (NEW.ano, NEW.mes, NEW.resumo, NEW.dado_ate, NEW.fechado_por, NEW.fechado_por_nome, NEW.fechado_em)
        IS DISTINCT FROM (OLD.ano, OLD.mes, OLD.resumo, OLD.dado_ate, OLD.fechado_por, OLD.fechado_por_nome, OLD.fechado_em) THEN
    RAISE EXCEPTION 'Fechamento congelado: só é possível reabrir.' USING ERRCODE = 'PT409';
  END IF;
  NEW.reaberto_por = auth.uid();
  NEW.reaberto_por_nome = v_nome;
  NEW.reaberto_em = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_fat_pontuacao_fechamentos_autoria ON public.fat_pontuacao_fechamentos;
CREATE TRIGGER trigger_fat_pontuacao_fechamentos_autoria
  BEFORE INSERT OR UPDATE ON public.fat_pontuacao_fechamentos
  FOR EACH ROW EXECUTE FUNCTION public.fat_pontuacao_fechamentos_set_autoria();

-- ─── Lançamento em mês fechado: recusado no banco, não só na tela.
-- SECURITY DEFINER para enxergar o fechamento independentemente da RLS.
CREATE OR REPLACE FUNCTION public.fat_pontuacao_lancamentos_bloquear_mes_fechado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fechado RECORD;
BEGIN
  -- UPDATE confere o mês antigo e o novo: não dá para tirar nem pôr lançamento num mês fechado.
  SELECT f.ano, f.mes INTO v_fechado
  FROM public.fat_pontuacao_fechamentos f
  WHERE f.reaberto_em IS NULL
    AND ((TG_OP <> 'DELETE' AND f.ano = NEW.ano AND f.mes = NEW.mes)
      OR (TG_OP <> 'INSERT' AND f.ano = OLD.ano AND f.mes = OLD.mes))
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'A pontuação de %/% está fechada: reabra o mês para alterar os lançamentos.',
      lpad(v_fechado.mes::text, 2, '0'), v_fechado.ano
      USING ERRCODE = 'PT409';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_fat_pontuacao_lancamentos_mes_fechado ON public.fat_pontuacao_lancamentos;
CREATE TRIGGER trigger_fat_pontuacao_lancamentos_mes_fechado
  BEFORE INSERT OR UPDATE OR DELETE ON public.fat_pontuacao_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.fat_pontuacao_lancamentos_bloquear_mes_fechado();

-- ─── RLS — mesmo padrão das outras tabelas da pontuação: canViewBilling lê,
-- canManageBilling fecha e reabre. Sem policy de DELETE: reabrir guarda o histórico.
ALTER TABLE public.fat_pontuacao_fechamentos ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fat_pontuacao_fechamentos'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.fat_pontuacao_fechamentos', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "fat_pontuacao_fechamentos_select_billing" ON public.fat_pontuacao_fechamentos
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewBilling')
      OR public.current_user_has_permission('canManageBilling'));

CREATE POLICY "fat_pontuacao_fechamentos_insert_billing" ON public.fat_pontuacao_fechamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageBilling'));

CREATE POLICY "fat_pontuacao_fechamentos_update_billing" ON public.fat_pontuacao_fechamentos
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageBilling'))
  WITH CHECK (public.current_user_has_permission('canManageBilling'));
