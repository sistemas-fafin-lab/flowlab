/*
  # Qualidade — Fechamento e reabertura do Relatório mensal de EPI por área

  Spec: .scratch/epi-relatorio-mensal/spec.md (issue 05; Situação de uma área no mês;
  Esquema → Fechamento e Histórico de reaberturas). Termos no CONTEXT.md, seção Estoque e
  Qualidade.

  1. Permissão `canCloseEpiReport` ("Fechar relatórios de EPI", grupo Qualidade em
     src/utils/permissions.ts): fecha e reabre (e, na issue 06, anexa). Só o cargo
     Administrador recebe por padrão; a Qualidade recebe na tela de Cargos e Permissões.

  2. `epi_relatorio_fechamentos`: um único registro por (área, mês), com a situação
     (aberto, fechado, assinado), as linhas congeladas no último fechamento e quem fechou e
     quando. Reabrir volta a situação para aberto; fechar de novo congela o conteúdo atual
     no mesmo registro.

  3. `epi_relatorio_reaberturas`: o histórico de reaberturas, com o motivo (obrigatório),
     quem reabriu e quando, e quem tinha fechado e quando (o fechamento desfeito), para que
     o histórico mostre cada fechamento mesmo depois de fechar de novo.

  4. Escrita só pelas RPCs `epi_fechar_relatorio` e `epi_reabrir_relatorio`, SECURITY
     DEFINER, que conferem `canCloseEpiReport`, aplicam as mesmas transições do domínio
     (src/modules/qualidade/domain/epiRelatorioMensal.ts → transicaoFechamentoEpi) com a
     linha travada e gravam sempre o usuário da sessão. As tabelas não têm policy de
     INSERT/UPDATE/DELETE: escrita direta é recusada pela RLS, e o histórico não se apaga.
     Transição inválida → SQLSTATE PT409 (HTTP 409 no PostgREST).

  5. Leitura (RLS): `canViewEpiReport` ou `canCloseEpiReport`.

  As linhas congeladas são as que a tela calcula no momento do fechamento, as mesmas do PDF.
*/

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

-- ─── Permissão ───────────────────────────────────────────────────────────────
UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canCloseEpiReport"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canCloseEpiReport';

-- ─── Tabelas ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.epi_relatorio_fechamentos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area              TEXT NOT NULL CHECK (btrim(area) <> ''),
  mes               TEXT NOT NULL CHECK (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  situacao          TEXT NOT NULL CHECK (situacao IN ('aberto', 'fechado', 'assinado')),
  linhas            JSONB NOT NULL CHECK (jsonb_typeof(linhas) = 'array'),
  fechado_por       UUID REFERENCES auth.users(id),
  fechado_por_nome  TEXT,
  fechado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT epi_relatorio_fechamentos_area_mes_key UNIQUE (area, mes)
);

COMMENT ON TABLE public.epi_relatorio_fechamentos IS 'Fechamento do Relatório mensal de EPI de uma área num mês (Qualidade → EPIs): situação, linhas congeladas no último fechamento e quem fechou. Um registro por (área, mês). Escrita só pelas RPCs epi_fechar_relatorio / epi_reabrir_relatorio.';

CREATE TABLE IF NOT EXISTS public.epi_relatorio_reaberturas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id     UUID NOT NULL REFERENCES public.epi_relatorio_fechamentos(id) ON DELETE RESTRICT,
  motivo            TEXT NOT NULL CHECK (btrim(motivo) <> ''),
  fechado_por       UUID REFERENCES auth.users(id),
  fechado_por_nome  TEXT,
  fechado_em        TIMESTAMPTZ NOT NULL,
  reaberto_por      UUID REFERENCES auth.users(id),
  reaberto_por_nome TEXT,
  reaberto_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_epi_relatorio_reaberturas_fechamento
  ON public.epi_relatorio_reaberturas (fechamento_id, reaberto_em);

COMMENT ON TABLE public.epi_relatorio_reaberturas IS 'Histórico de reaberturas do Relatório mensal de EPI: motivo, quem reabriu e quando, e o fechamento desfeito (quem fechou e quando).';

-- ─── RLS: só leitura; a escrita passa pelas RPCs ─────────────────────────────
ALTER TABLE public.epi_relatorio_fechamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epi_relatorio_reaberturas ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename IN ('epi_relatorio_fechamentos', 'epi_relatorio_reaberturas')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

CREATE POLICY "epi_relatorio_fechamentos_select" ON public.epi_relatorio_fechamentos
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewEpiReport')
      OR public.current_user_has_permission('canCloseEpiReport'));

CREATE POLICY "epi_relatorio_reaberturas_select" ON public.epi_relatorio_reaberturas
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewEpiReport')
      OR public.current_user_has_permission('canCloseEpiReport'));

-- ─── RPCs ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.epi_nome_usuario_sessao()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(btrim(up.name), ''), up.email) FROM public.user_profiles up WHERE up.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.epi_nome_usuario_sessao() FROM PUBLIC;

-- Fechar: aberto (ou sem registro) → fechado, congelando as linhas.
CREATE OR REPLACE FUNCTION public.epi_fechar_relatorio(p_area TEXT, p_mes TEXT, p_linhas JSONB)
RETURNS public.epi_relatorio_fechamentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atual public.epi_relatorio_fechamentos;
  v_resultado public.epi_relatorio_fechamentos;
BEGIN
  IF NOT public.current_user_has_permission('canCloseEpiReport') THEN
    RAISE EXCEPTION 'Você não tem permissão para fechar relatórios de EPI.' USING ERRCODE = '42501';
  END IF;
  IF p_linhas IS NULL OR jsonb_typeof(p_linhas) <> 'array' THEN
    RAISE EXCEPTION 'As linhas do relatório precisam ser uma lista.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_atual FROM public.epi_relatorio_fechamentos
   WHERE area = p_area AND mes = p_mes
   FOR UPDATE;

  IF FOUND AND v_atual.situacao <> 'aberto' THEN
    RAISE EXCEPTION 'A área já está fechada.' USING ERRCODE = 'PT409';
  END IF;

  INSERT INTO public.epi_relatorio_fechamentos AS f
         (area, mes, situacao, linhas, fechado_por, fechado_por_nome, fechado_em, atualizado_em)
  VALUES (p_area, p_mes, 'fechado', p_linhas, auth.uid(), public.epi_nome_usuario_sessao(), NOW(), NOW())
  ON CONFLICT (area, mes) DO UPDATE
     SET situacao = 'fechado',
         linhas = EXCLUDED.linhas,
         fechado_por = EXCLUDED.fechado_por,
         fechado_por_nome = EXCLUDED.fechado_por_nome,
         fechado_em = EXCLUDED.fechado_em,
         atualizado_em = EXCLUDED.atualizado_em
   WHERE f.situacao = 'aberto'
  RETURNING * INTO v_resultado;

  -- Corrida: outro usuário fechou entre o SELECT (sem registro) e o INSERT.
  IF v_resultado.id IS NULL THEN
    RAISE EXCEPTION 'A área já está fechada.' USING ERRCODE = 'PT409';
  END IF;

  RETURN v_resultado;
END;
$$;

-- Reabrir: fechado ou assinado → aberto, com motivo obrigatório e registro no histórico.
CREATE OR REPLACE FUNCTION public.epi_reabrir_relatorio(p_area TEXT, p_mes TEXT, p_motivo TEXT)
RETURNS public.epi_relatorio_fechamentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atual public.epi_relatorio_fechamentos;
  v_resultado public.epi_relatorio_fechamentos;
BEGIN
  IF NOT public.current_user_has_permission('canCloseEpiReport') THEN
    RAISE EXCEPTION 'Você não tem permissão para reabrir relatórios de EPI.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_atual FROM public.epi_relatorio_fechamentos
   WHERE area = p_area AND mes = p_mes
   FOR UPDATE;

  IF NOT FOUND OR v_atual.situacao = 'aberto' THEN
    RAISE EXCEPTION 'A área já está aberta.' USING ERRCODE = 'PT409';
  END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Informe o motivo da reabertura.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.epi_relatorio_reaberturas
         (fechamento_id, motivo, fechado_por, fechado_por_nome, fechado_em, reaberto_por, reaberto_por_nome)
  VALUES (v_atual.id, btrim(p_motivo), v_atual.fechado_por, v_atual.fechado_por_nome, v_atual.fechado_em,
          auth.uid(), public.epi_nome_usuario_sessao());

  UPDATE public.epi_relatorio_fechamentos
     SET situacao = 'aberto', atualizado_em = NOW()
   WHERE id = v_atual.id
  RETURNING * INTO v_resultado;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.epi_fechar_relatorio(TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.epi_reabrir_relatorio(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.epi_fechar_relatorio(TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.epi_reabrir_relatorio(TEXT, TEXT, TEXT) TO authenticated;
