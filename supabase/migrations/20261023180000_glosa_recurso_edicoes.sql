-- ═══════════════════════════════════════════════════════════════════════════════
-- Glosas e Recursos — edições manuais (lápis)
-- Migration: 20261023180000_glosa_recurso_edicoes.sql
--
-- Issue 07 de .scratch/glosas-recursos-dashboard/. O apLIS não guarda a data
-- real de envio do recurso, nem a de retorno, nem a de pagamento, e perde a
-- glosa original quando o recurso é pago. A responsável corrige pelo lápis do
-- card "Detalhes do recurso" (/api/faturamento/glosas-recursos-editar):
--
--   lote        data de envio, data real de retorno, data real de pagamento
--   requisição  valor recursado, valor recebido de glosa
--
-- Cada campo editado tem o valor, quem editou e quando, em colunas da própria
-- foto. A sincronização não manda essas colunas no upsert, então não as
-- sobrescreve; o valor editado vale acima do apLIS (null = vale o apLIS).
-- Cada edição também vira evento 'edicao_manual' em glosa_recurso_historico,
-- com usuário, valor anterior e valor novo — na mesma transação, pela RPC
-- glosa_recurso_gravar_edicao: edição sem evento (ou evento sem edição) não
-- acontece.
--
-- RLS: as políticas de UPDATE das fotos (20261023150000) já exigem
-- canManageBilling — só quem gerencia o faturamento grava a edição.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.glosa_recurso_historico') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.glosa_recurso_historico não existe. Aplique 20261023170000_glosa_recurso_historico.sql antes desta migration.';
  END IF;
END $$;

-- ─── Lote de recurso ─────────────────────────────────────────────────────────
ALTER TABLE public.glosa_recurso_lotes
  ADD COLUMN IF NOT EXISTS data_envio_editada             DATE,
  ADD COLUMN IF NOT EXISTS data_envio_editada_por         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_envio_editada_em          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_retorno_real              DATE,
  ADD COLUMN IF NOT EXISTS data_retorno_real_por          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_retorno_real_em           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_pagamento_real            DATE,
  ADD COLUMN IF NOT EXISTS data_pagamento_real_por        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_pagamento_real_em         TIMESTAMPTZ;

COMMENT ON COLUMN public.glosa_recurso_lotes.data_envio_editada IS 'Data real de envio corrigida pelo lápis; vale acima de data_envio_aplis.';
COMMENT ON COLUMN public.glosa_recurso_lotes.data_retorno_real IS 'Retorno real da operadora, registrado pelo lápis: encerra o selo de atraso e é a base do pagamento previsto.';
COMMENT ON COLUMN public.glosa_recurso_lotes.data_pagamento_real IS 'Pagamento real do recurso, registrado pelo lápis.';

-- ─── Requisição ──────────────────────────────────────────────────────────────
ALTER TABLE public.glosa_recurso_requisicoes
  ADD COLUMN IF NOT EXISTS valor_recursado_editado          DECIMAL(15, 2) CHECK (valor_recursado_editado >= 0),
  ADD COLUMN IF NOT EXISTS valor_recursado_editado_por      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valor_recursado_editado_em       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valor_recebido_glosa_editado     DECIMAL(15, 2) CHECK (valor_recebido_glosa_editado >= 0),
  ADD COLUMN IF NOT EXISTS valor_recebido_glosa_editado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valor_recebido_glosa_editado_em  TIMESTAMPTZ;

COMMENT ON COLUMN public.glosa_recurso_requisicoes.valor_recursado_editado IS 'Valor recursado corrigido pelo lápis; vale acima de valor_recursado (apLIS).';
COMMENT ON COLUMN public.glosa_recurso_requisicoes.valor_recebido_glosa_editado IS 'Valor recebido de glosa corrigido pelo lápis; substitui o ΔRec (recebido − recebido_fixacao).';

-- ─── Histórico: evento de edição manual ──────────────────────────────────────
ALTER TABLE public.glosa_recurso_historico DROP CONSTRAINT IF EXISTS glosa_recurso_historico_tipo_check;
ALTER TABLE public.glosa_recurso_historico ADD CONSTRAINT glosa_recurso_historico_tipo_check CHECK (tipo IN (
  'inicio_acompanhamento',
  'entrada_lote_recurso',
  'mudanca_status',
  'mudanca_recebido',
  'envio_lote',
  'edicao_manual'
));

-- ─── View da sub-aba "Lotes de recurso", com os valores editados ─────────────
-- data_envio e valor_recorrido passam a ser os que valem (editado acima do
-- apLIS). Um lote "Criado" no apLIS com data de envio editada já foi enviado
-- de fato: aparece como "Enviado". DROP + CREATE: colunas mudam de posição.
DROP VIEW IF EXISTS public.glosa_recurso_lotes_lista;

CREATE VIEW public.glosa_recurso_lotes_lista
WITH (security_invoker = true) AS
SELECT
  l.id_lote_recurso,
  r.competencia,
  l.status_aplis,
  CASE
    WHEN l.status_label = 'Criado' AND l.data_envio_editada IS NOT NULL THEN 'Enviado'
    ELSE l.status_label
  END                                     AS status_label,
  l.protocolo,
  l.protocolo_faturamento,
  l.id_fonte_pagadora,
  l.fonte_pagadora_nome,
  l.data_criacao_aplis,
  l.data_envio_aplis,
  COALESCE(l.data_envio_editada, l.data_envio_aplis) AS data_envio,
  l.data_envio_editada IS NOT NULL        AS data_envio_editada,
  l.data_retorno_real,
  l.data_pagamento_real,
  array_agg(DISTINCT r.id_fonte_pagadora) AS fontes_requisicoes,
  COUNT(*)::INTEGER                       AS qtd_requisicoes,
  COALESCE(SUM(r.glosa_fixada), 0)        AS valor_glosado,
  COALESCE(SUM(COALESCE(r.valor_recursado_editado, r.valor_recursado)), 0) AS valor_recorrido,
  concat_ws(' ',
    l.id_lote_recurso::TEXT, l.protocolo, l.protocolo_faturamento, l.fonte_pagadora_nome,
    string_agg(concat_ws(' ', r.num_guia, r.paciente, r.cod_requisicao), ' ')
  )                                       AS busca
FROM public.glosa_recurso_lotes l
JOIN public.glosa_recurso_requisicoes r ON r.id_lote_recurso = l.id_lote_recurso
GROUP BY l.id_lote_recurso, r.competencia;

COMMENT ON VIEW public.glosa_recurso_lotes_lista IS 'Lotes de recurso por mês de faturamento, com valor glosado (Σ glosa fixada) e recorrido (Σ recursado, o editado acima do apLIS).';

GRANT SELECT ON public.glosa_recurso_lotes_lista TO authenticated;

-- ─── RPC: grava a edição e o evento numa transação só ────────────────────────
-- A rota calcula o evento (recursoGlosa.eventoEdicaoManual) e chama esta
-- função com o cliente do usuário. SECURITY INVOKER: a RLS das fotos e do
-- histórico vale; a checagem explícita só troca a recusa silenciosa da RLS
-- (zero linhas) por uma mensagem clara. O usuário é auth.uid(), nunca o que
-- vem da rota. p_valor null remove a edição (e quem/quando).
CREATE OR REPLACE FUNCTION public.glosa_recurso_gravar_edicao(
  p_tabela          TEXT,
  p_id              INTEGER,
  p_coluna          TEXT,
  p_valor           TEXT,
  p_id_requisicao   INTEGER,
  p_id_lote_recurso INTEGER,
  p_valor_anterior  TEXT,
  p_valor_novo      TEXT,
  p_descricao       TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario UUID := auth.uid();
  v_tipo    TEXT;
  v_chave   TEXT;
  v_linhas  INTEGER;
  v_agora   TIMESTAMPTZ := NOW();
BEGIN
  IF v_usuario IS NULL OR NOT public.current_user_has_permission('canManageBilling') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar contas a receber.' USING ERRCODE = '42501';
  END IF;

  -- Só as colunas do lápis: o nome vira SQL dinâmico.
  CASE p_tabela || '.' || p_coluna
    WHEN 'glosa_recurso_lotes.data_envio_editada'                  THEN v_tipo := 'date';
    WHEN 'glosa_recurso_lotes.data_retorno_real'                   THEN v_tipo := 'date';
    WHEN 'glosa_recurso_lotes.data_pagamento_real'                 THEN v_tipo := 'date';
    WHEN 'glosa_recurso_requisicoes.valor_recursado_editado'       THEN v_tipo := 'numeric';
    WHEN 'glosa_recurso_requisicoes.valor_recebido_glosa_editado'  THEN v_tipo := 'numeric';
    ELSE RAISE EXCEPTION 'Campo não editável: %.%', p_tabela, p_coluna USING ERRCODE = '22023';
  END CASE;
  v_chave := CASE p_tabela WHEN 'glosa_recurso_lotes' THEN 'id_lote_recurso' ELSE 'id_requisicao' END;

  EXECUTE format(
    'UPDATE public.%I SET %I = $1::%s, %I = $2, %I = $3 WHERE %I = $4',
    p_tabela, p_coluna, v_tipo, p_coluna || '_por', p_coluna || '_em', v_chave
  ) USING p_valor,
          CASE WHEN p_valor IS NULL THEN NULL ELSE v_usuario END,
          CASE WHEN p_valor IS NULL THEN NULL ELSE v_agora END,
          p_id;
  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas = 0 THEN
    RAISE EXCEPTION 'Registro não encontrado na foto de glosas e recursos.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.glosa_recurso_historico
    (id_requisicao, id_lote_recurso, ocorrido_em, tipo, valor_anterior, valor_novo, descricao, usuario_id)
  VALUES
    (p_id_requisicao, p_id_lote_recurso, v_agora, 'edicao_manual', p_valor_anterior, p_valor_novo, p_descricao, v_usuario);
END;
$$;

REVOKE ALL ON FUNCTION public.glosa_recurso_gravar_edicao(TEXT, INTEGER, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.glosa_recurso_gravar_edicao(TEXT, INTEGER, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
