-- ═══════════════════════════════════════════════════════════════════════════════
-- Glosas e Recursos — Calendário de recursos
-- Migration: 20261126160000_glosa_recurso_calendario.sql
--
-- Issue 03 de .scratch/glosas-recursos-calendario-pendencias/. Cada item do
-- calendário é um lote de faturamento de um convênio, com o nº do lote e o
-- protocolo. A foto já guarda o lote (id_lote_faturamento); passa a guardar o
-- protocolo dele (fatlote.Protocolo), gravado pela sincronização. Até a
-- próxima sincronização do mês, o protocolo fica vazio.
--
-- A view glosa_recurso_requisicoes_lista ganha, no fim (CREATE OR REPLACE VIEW
-- não reordena colunas):
--   id_lote_faturamento          lote de faturamento original
--   protocolo_lote_faturamento   fatlote.Protocolo
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.glosa_recurso_requisicoes_lista') IS NULL THEN
    RAISE EXCEPTION 'View public.glosa_recurso_requisicoes_lista não existe. Aplique 20261023200000_glosa_recurso_glosas_recentes.sql antes desta migration.';
  END IF;
END $$;

ALTER TABLE public.glosa_recurso_requisicoes
  ADD COLUMN IF NOT EXISTS protocolo_lote_faturamento TEXT;

COMMENT ON COLUMN public.glosa_recurso_requisicoes.protocolo_lote_faturamento IS 'fatlote.Protocolo do lote de faturamento original: o protocolo mostrado no Calendário de recursos.';

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
  COALESCE(l.data_envio_editada, l.data_envio_aplis) IS NOT NULL AS lote_enviado,
  r.id_lote_faturamento,
  r.protocolo_lote_faturamento
FROM public.glosa_recurso_requisicoes r
LEFT JOIN public.glosa_recurso_lotes l ON l.id_lote_recurso = r.id_lote_recurso;

COMMENT ON VIEW public.glosa_recurso_requisicoes_lista IS 'Foto das requisições glosadas ou recursadas com a coluna de busca e o que a classificação lê, para as listas da tela Glosas e Recursos.';

GRANT SELECT ON public.glosa_recurso_requisicoes_lista TO authenticated;

-- Calendário de recursos: as glosadas sem recurso de todos os meses.
CREATE INDEX IF NOT EXISTS glosa_recurso_requisicoes_status_idx
  ON public.glosa_recurso_requisicoes (status_aplis, id_fonte_pagadora);
