-- ═══════════════════════════════════════════════════════════════════════════════
-- Glosas e Recursos — foto do apLIS no FlowLab
-- Migration: 20261023150000_glosa_recurso_foto.sql
--
-- Issue 01 de .scratch/glosas-recursos-dashboard/. A fonte é o apLIS (MySQL de
-- backup); o FlowLab guarda uma foto de cada requisição glosada ou recursada e
-- dos lotes de recurso dela, gravada pela sincronização
-- (/api/faturamento/glosas-recursos-sincronizar, regras em
-- api/_lib/faturamento/recursoGlosa.ts). O que o apLIS perde — a glosa original,
-- sobrescrita pelo recebido quando o recurso é pago — fica fixado aqui.
--
--   glosa_recurso_lotes          → foto do lote de recurso (fatloterecurso)
--   glosa_recurso_requisicoes    → foto da requisição, com a glosa fixada
--   glosa_recurso_sincronizacoes → cada sincronização (mês + convênio): diz se
--                                  uma requisição nova é carga inicial e quando
--                                  foi a última atualização
--   glosa_recurso_lotes_lista    → view da sub-aba "Lotes de recurso"
--
-- RLS no padrão do faturamento (20260807120000): lê quem vê o faturamento,
-- grava quem gerencia. A sincronização grava com service_role: é espelho do
-- apLIS, não edição do operador.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

-- ─── Foto do lote de recurso ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.glosa_recurso_lotes (
  id_lote_recurso         INTEGER PRIMARY KEY,
  status_aplis            SMALLINT NOT NULL,
  status_label            TEXT NOT NULL,
  protocolo               TEXT,
  protocolo_faturamento   TEXT,
  id_fonte_pagadora       INTEGER,
  fonte_pagadora_nome     TEXT,
  data_criacao_aplis      DATE,
  data_envio_aplis        DATE,
  data_finalizacao_aplis  DATE,
  data_cancelamento_aplis DATE,
  primeira_sincronizacao  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_sincronizacao    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.glosa_recurso_lotes IS 'Foto de fatloterecurso no apLIS, gravada pela sincronização de Glosas e Recursos.';
COMMENT ON COLUMN public.glosa_recurso_lotes.id_lote_recurso IS 'fatloterecurso.IdLoteRecurso.';
COMMENT ON COLUMN public.glosa_recurso_lotes.status_label IS 'Derivado das datas do apLIS (Criado, Enviado, Finalizado, Cancelado): fatloterecurso.Status não tem tabela de rótulo.';
COMMENT ON COLUMN public.glosa_recurso_lotes.protocolo IS 'fatloterecurso.Protocolo: protocolo do recurso na operadora.';
COMMENT ON COLUMN public.glosa_recurso_lotes.protocolo_faturamento IS 'fatloterecurso.ProtocoloRecursado: protocolo do faturamento recorrido.';

-- ─── Foto da requisição glosada/recursada ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.glosa_recurso_requisicoes (
  id_requisicao          INTEGER PRIMARY KEY,
  cod_requisicao         TEXT,
  num_guia               TEXT,
  paciente               TEXT,
  id_lote_faturamento    INTEGER NOT NULL,
  competencia            TEXT NOT NULL CHECK (competencia ~ '^\d{4}-\d{2}$'),
  id_fonte_pagadora      INTEGER,
  fonte_pagadora_nome    TEXT,
  id_lote_recurso        INTEGER REFERENCES public.glosa_recurso_lotes(id_lote_recurso) ON DELETE SET NULL,
  status_aplis           SMALLINT,
  liquido                DECIMAL(15, 2) NOT NULL,
  recebido               DECIMAL(15, 2) NOT NULL,
  glosa_fixada           DECIMAL(15, 2),
  recebido_fixacao       DECIMAL(15, 2),
  valor_recursado        DECIMAL(15, 2),
  valor_inicial_estimado BOOLEAN NOT NULL DEFAULT FALSE,
  primeira_sincronizacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_sincronizacao   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.glosa_recurso_requisicoes IS 'Foto da requisição glosada ou recursada no apLIS. A glosa fixada não muda depois da primeira sincronização.';
COMMENT ON COLUMN public.glosa_recurso_requisicoes.competencia IS 'YYYY-MM de fatlote.DtaCriacao do lote de faturamento original: o período da tela.';
COMMENT ON COLUMN public.glosa_recurso_requisicoes.id_lote_recurso IS 'Lote de recurso mais recente da requisição; null fora de lote.';
COMMENT ON COLUMN public.glosa_recurso_requisicoes.status_aplis IS 'requisicao.CodEventoFatur (evento de faturamento).';
COMMENT ON COLUMN public.glosa_recurso_requisicoes.glosa_fixada IS 'Líquido − recebido na fixação; no deferido total, o recursado do lote (null sem lote).';
COMMENT ON COLUMN public.glosa_recurso_requisicoes.recebido_fixacao IS 'Recebido no momento da fixação: base do ΔRec da classificação.';
COMMENT ON COLUMN public.glosa_recurso_requisicoes.valor_recursado IS 'Σ VlrRecurso da requisição no lote de recurso.';
COMMENT ON COLUMN public.glosa_recurso_requisicoes.valor_inicial_estimado IS 'A foto foi tirada depois do envio do recurso: a glosa fixada pode não ser a original.';

CREATE INDEX IF NOT EXISTS glosa_recurso_requisicoes_competencia_idx
  ON public.glosa_recurso_requisicoes (competencia, id_fonte_pagadora);
CREATE INDEX IF NOT EXISTS glosa_recurso_requisicoes_lote_recurso_idx
  ON public.glosa_recurso_requisicoes (id_lote_recurso);

-- ─── Sincronizações ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.glosa_recurso_sincronizacoes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia       TEXT NOT NULL CHECK (competencia ~ '^\d{4}-\d{2}$'),
  -- null: todos os convênios.
  id_fonte_pagadora INTEGER,
  sincronizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sincronizado_por  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dado_ate          DATE,
  requisicoes       INTEGER NOT NULL DEFAULT 0,
  lotes             INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.glosa_recurso_sincronizacoes IS 'Cada sincronização da foto de glosas e recursos. Sem uma anterior que cubra o mês e o convênio, a requisição nova é carga inicial (valor inicial estimado).';
COMMENT ON COLUMN public.glosa_recurso_sincronizacoes.dado_ate IS 'Data do dado mais recente da réplica do apLIS (~1 dia de atraso).';

CREATE INDEX IF NOT EXISTS glosa_recurso_sincronizacoes_competencia_idx
  ON public.glosa_recurso_sincronizacoes (competencia, sincronizado_em DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.glosa_recurso_lotes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glosa_recurso_requisicoes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glosa_recurso_sincronizacoes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  p record;
  ver text := '(public.current_user_has_permission(''canViewBilling'') OR public.current_user_has_permission(''canManageBilling''))';
  gerir text := 'public.current_user_has_permission(''canManageBilling'')';
BEGIN
  FOREACH t IN ARRAY ARRAY['glosa_recurso_lotes','glosa_recurso_requisicoes','glosa_recurso_sincronizacoes']
  LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
                   t || '_select_billing', t, ver);
  END LOOP;

  -- O log de sincronização é só escrito pela rota (service_role).
  FOREACH t IN ARRAY ARRAY['glosa_recurso_lotes','glosa_recurso_requisicoes']
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
                   t || '_insert_billing', t, gerir);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
                   t || '_update_billing', t, gerir, gerir);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)',
                   t || '_delete_billing', t, gerir);
  END LOOP;
END $$;

-- ─── View da sub-aba "Lotes de recurso" ──────────────────────────────────────
-- Uma linha por lote de recurso e mês de faturamento: o período da tela é o
-- mês do lote de faturamento original da requisição, e um lote de recurso pode
-- juntar requisições de meses diferentes. `busca` junta o que a busca da tela
-- procura (lote, protocolos, convênio, guia, paciente). security_invoker: a
-- view respeita a RLS de quem consulta.
CREATE OR REPLACE VIEW public.glosa_recurso_lotes_lista
WITH (security_invoker = true) AS
SELECT
  l.id_lote_recurso,
  r.competencia,
  l.status_aplis,
  l.status_label,
  l.protocolo,
  l.protocolo_faturamento,
  l.id_fonte_pagadora,
  l.fonte_pagadora_nome,
  l.data_criacao_aplis,
  l.data_envio_aplis,
  -- O filtro de convênio usa a fonte da requisição, como a sincronização:
  -- os dois cadastros do Bradesco podem divergir entre lote e requisição.
  array_agg(DISTINCT r.id_fonte_pagadora) AS fontes_requisicoes,
  COUNT(*)::INTEGER                       AS qtd_requisicoes,
  COALESCE(SUM(r.glosa_fixada), 0)        AS valor_glosado,
  COALESCE(SUM(r.valor_recursado), 0)     AS valor_recorrido,
  concat_ws(' ',
    l.id_lote_recurso::TEXT, l.protocolo, l.protocolo_faturamento, l.fonte_pagadora_nome,
    string_agg(concat_ws(' ', r.num_guia, r.paciente, r.cod_requisicao), ' ')
  )                                       AS busca
FROM public.glosa_recurso_lotes l
JOIN public.glosa_recurso_requisicoes r ON r.id_lote_recurso = l.id_lote_recurso
GROUP BY l.id_lote_recurso, r.competencia;

COMMENT ON VIEW public.glosa_recurso_lotes_lista IS 'Lotes de recurso por mês de faturamento, com valor glosado (Σ glosa fixada) e recorrido (Σ recursado).';

GRANT SELECT ON public.glosa_recurso_lotes_lista TO authenticated;
