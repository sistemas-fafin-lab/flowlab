-- ═══════════════════════════════════════════════════════════════════════════════
-- Glosas e Recursos — status da glosa na lista de requisições
-- Migration: 20261023200000_glosa_recurso_glosas_recentes.sql
--
-- Issue 10 de .scratch/glosas-recursos-dashboard/ (aba "Glosas recentes"). A
-- linha mostra o status traduzido como no Dashboard (Aberta, Em recurso,
-- Revertida, Definitiva), que sai da classificação da requisição
-- (api/_lib/faturamento/recursoGlosa.ts → statusDashboard). A view
-- glosa_recurso_requisicoes_lista passa a trazer o que a classificação lê:
--
--   liquido, recebido, recebido_fixacao, valor_recursado   foto do apLIS
--   valor_recursado_editado, valor_recebido_glosa_editado   lápis (ticket 07)
--   lote_enviado    o lote de recurso tem data de envio (editada ou do apLIS)
--
-- As colunas novas vão no fim: CREATE OR REPLACE VIEW não reordena colunas.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.glosa_recurso_requisicoes_lista') IS NULL THEN
    RAISE EXCEPTION 'View public.glosa_recurso_requisicoes_lista não existe. Aplique 20261023190000_glosa_recurso_fora_de_lote.sql antes desta migration.';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.glosa_recurso_requisicoes_lista
WITH (security_invoker = true) AS
SELECT
  r.id_requisicao,
  r.cod_requisicao,
  r.num_guia,
  r.paciente,
  r.competencia,
  r.id_fonte_pagadora,
  r.fonte_pagadora_nome,
  r.id_lote_recurso,
  r.status_aplis,
  r.glosa_fixada,
  r.valor_inicial_estimado,
  r.data_recebimento,
  r.procedimentos,
  r.motivos,
  concat_ws(' ',
    r.num_guia, r.paciente, r.fonte_pagadora_nome, r.cod_requisicao,
    array_to_string(r.procedimentos, ' '), array_to_string(r.motivos, ' ')
  ) AS busca,
  r.liquido,
  r.recebido,
  r.recebido_fixacao,
  r.valor_recursado,
  r.valor_recursado_editado,
  r.valor_recebido_glosa_editado,
  COALESCE(l.data_envio_editada, l.data_envio_aplis) IS NOT NULL AS lote_enviado
FROM public.glosa_recurso_requisicoes r
LEFT JOIN public.glosa_recurso_lotes l ON l.id_lote_recurso = r.id_lote_recurso;

COMMENT ON VIEW public.glosa_recurso_requisicoes_lista IS 'Foto das requisições glosadas ou recursadas com a coluna de busca e o que a classificação lê, para as listas da tela Glosas e Recursos.';

GRANT SELECT ON public.glosa_recurso_requisicoes_lista TO authenticated;

-- Glosas recentes: todas as requisições do mês, da mais recente para a mais antiga.
CREATE INDEX IF NOT EXISTS glosa_recurso_requisicoes_recentes_idx
  ON public.glosa_recurso_requisicoes (competencia, data_recebimento DESC);
