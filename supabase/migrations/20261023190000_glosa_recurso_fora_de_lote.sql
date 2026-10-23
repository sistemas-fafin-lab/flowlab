-- ═══════════════════════════════════════════════════════════════════════════════
-- Glosas e Recursos — dados da glosa na foto e lista de requisições
-- Migration: 20261023190000_glosa_recurso_fora_de_lote.sql
--
-- Issue 09 de .scratch/glosas-recursos-dashboard/ (sub-aba "Recursos fora de
-- lote"). A linha da requisição mostra data da glosa, procedimento e motivo, e
-- o prazo para recorrer conta da data de recebimento da requisição. A
-- sincronização (/api/faturamento/glosas-recursos-sincronizar) passa a gravar:
--
--   data_recebimento  último fatrequisicaoprocedimento.DtaRecebido: a data da
--                     glosa e a base da regra GLOSA – RECURSO
--   procedimentos     procedimentos glosados ('código descrição')
--   motivos           motivos do catálogo fatmotivoglosa ('código descrição')
--
-- Fotos gravadas antes desta migration ficam com esses campos vazios até a
-- próxima sincronização do mês (botão "Atualizar" ou rotina diária).
--
-- glosa_recurso_requisicoes_lista: a foto com a coluna `busca` (guia,
-- paciente, convênio, procedimento, requisição, motivo) que as listas de
-- requisições da tela filtram com ILIKE.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.glosa_recurso_requisicoes') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.glosa_recurso_requisicoes não existe. Aplique 20261023150000_glosa_recurso_foto.sql antes desta migration.';
  END IF;
END $$;

ALTER TABLE public.glosa_recurso_requisicoes
  ADD COLUMN IF NOT EXISTS data_recebimento DATE,
  ADD COLUMN IF NOT EXISTS procedimentos    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS motivos          TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.glosa_recurso_requisicoes.data_recebimento IS 'Último DtaRecebido dos procedimentos: data da glosa e base do prazo para recorrer (regra GLOSA – RECURSO).';
COMMENT ON COLUMN public.glosa_recurso_requisicoes.procedimentos IS 'Procedimentos glosados (com motivo ou recebido abaixo do líquido), ''código descrição''.';
COMMENT ON COLUMN public.glosa_recurso_requisicoes.motivos IS 'Motivos de glosa do catálogo fatmotivoglosa, ''código descrição''.';

CREATE INDEX IF NOT EXISTS glosa_recurso_requisicoes_fora_de_lote_idx
  ON public.glosa_recurso_requisicoes (competencia, data_recebimento DESC)
  WHERE id_lote_recurso IS NULL;

-- security_invoker: a view respeita a RLS de quem consulta.
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
  ) AS busca
FROM public.glosa_recurso_requisicoes r;

COMMENT ON VIEW public.glosa_recurso_requisicoes_lista IS 'Foto das requisições glosadas ou recursadas com a coluna de busca das listas da tela Glosas e Recursos.';

GRANT SELECT ON public.glosa_recurso_requisicoes_lista TO authenticated;
