-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — Fontes Pagadoras: nome do exame no convênio
-- Migration: 20261022140000_custo_fontes_pagadoras_nome_exame_convenio.sql
--
-- Spec: .scratch/controle-custos-importacao-por-exame/spec.md (ticket 01).
--
-- A importação passa a gravar uma linha por exame da planilha do convênio,
-- com o nome que o convênio usa ("Nome do Exame"). Daí três tipos de linha:
--   - linha de exame   (exame_id preenchido): vale só para aquele exame —
--     com nome_exame_convenio quando veio da importação;
--   - linha não levantada (exame_id nulo, nome_exame_convenio preenchido):
--     a importação não achou exame parecido; não cobre exame nenhum até ser
--     vinculada na tela;
--   - linha geral do TUSS (exame_id nulo, nome_exame_convenio nulo): como
--     antes, vale para todos os exames do TUSS. A importação não cria mais.
--
-- A reimportação casa a linha não levantada por (tabela, TUSS, nome), daí a
-- unicidade abaixo. A contração das tabelas associadas (20261022150000)
-- restringe a unicidade por (tabela, TUSS) às linhas gerais.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.custo_fontes_pagadoras
  ADD COLUMN IF NOT EXISTS nome_exame_convenio TEXT;

COMMENT ON COLUMN public.custo_fontes_pagadoras.nome_exame_convenio IS
  'Nome do exame na tabela do convênio, gravado pela importação. Preenchido com exame_id nulo = linha não levantada (não cobre exame nenhum).';

ALTER TABLE public.custo_fontes_pagadoras
  DROP CONSTRAINT IF EXISTS custo_fontes_pagadoras_nome_exame_convenio_preenchido;

ALTER TABLE public.custo_fontes_pagadoras
  ADD CONSTRAINT custo_fontes_pagadoras_nome_exame_convenio_preenchido
  CHECK (nome_exame_convenio IS NULL OR btrim(nome_exame_convenio) <> '');

CREATE UNIQUE INDEX IF NOT EXISTS custo_fontes_pagadoras_tabela_tuss_nome_convenio_key
  ON public.custo_fontes_pagadoras (tabela_associada_id, btrim(tuss), lower(btrim(nome_exame_convenio)))
  WHERE exame_id IS NULL AND nome_exame_convenio IS NOT NULL;
