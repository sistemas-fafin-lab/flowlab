-- ═══════════════════════════════════════════════════════════════════════════════
-- Confirmação automática D+1 no Calendário de envios (.scratch/faturamento-calendario-envios/,
-- issue 07).
--
-- Ao abrir um mês, a API lê do backup do apLIS os lotes enviados e os casa com os
-- Agendamentos de envio (casarLotes, api/_lib/faturamento/calendarioEnvios.ts). Esta
-- migration dá o que o casamento precisa:
--
-- 1. fat_envio_regras.convenios_aplis: no apLIS os membros dos agrupadores AMHPDF não
--    são fontes pagadoras próprias (as de AFEB, SERPRO, BACEN… estão inativas e sem
--    lote desde 2025). Eles são convênios (`fatconvenio.IdConvenio`, gravado em
--    `requisicao.IdConvenio`) da fonte AMHP-DF (1025), um convênio por lote. A regra
--    com convênios membros recebe os lotes deles; a regra só da fonte (AMHP) recebe os
--    lotes de AMHP-DF que nenhum agrupador cobre.
-- 2. Os ids do apLIS de cada regra, levantados no banco do lab em 28/10/2026 (fontes
--    com lote em 2025–2026; as variantes inativas e sem lote ficam de fora). Só
--    preenche regras que ainda estão sem fonte e sem convênio, para não desfazer um
--    ajuste feito na tela.
-- 3. Um lote confirma no máximo um agendamento (índice único).
-- 4. fat_envio_confirmar_aplis: grava as confirmações. Só o service_role executa: a
--    confirmação roda sem usuário (auth.uid() nulo), então "marcado por" e o
--    histórico ("marcou" e "confirmou_aplis") ficam sem autor, e funciona também para
--    quem só vê o Calendário. Idempotente: agendamento que já tem lote, ou lote que já
--    está em outro agendamento, fica como está. Data de envio só é gravada se o
--    agendamento continua sem marcação; a data informada pela faturista prevalece.
--    Duas telas abrindo o mês ao mesmo tempo gravam uma depois da outra (trava da
--    transação): a segunda já vê os lotes da primeira e não esbarra no índice único.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.fat_envio_regras') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.fat_envio_regras não existe. Aplique 20261028160000_fat_calendario_envios.sql antes desta migration.';
  END IF;
END $$;

-- ─── Convênios membros ────────────────────────────────────────────────────────

ALTER TABLE public.fat_envio_regras
  ADD COLUMN IF NOT EXISTS convenios_aplis INTEGER[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.fat_envio_regras.convenios_aplis IS
  'fatconvenio.IdConvenio dos convênios membros (agrupadores AMHPDF): a regra recebe os lotes cujas requisições são desses convênios.';

-- ─── Ids do apLIS da carga inicial ────────────────────────────────────────────
-- AMPLA SAÚDE (1362) ainda não tem lote no backup; fica com a fonte para quando tiver.
-- BACEN está em "AMHP – BACEN" e em "AMHPDF – Online" (como na planilha): o lote vai
-- para o agendamento pendente mais próximo das duas.

UPDATE public.fat_envio_regras r
   SET fontes_pagadoras = v.fontes,
       convenios_aplis = v.convenios
  FROM (VALUES
    ('AMIL',                    ARRAY[1007],             ARRAY[]::INTEGER[]),
    ('AMHP',                    ARRAY[1025],             ARRAY[]::INTEGER[]),
    ('AMHP – BACEN',            ARRAY[1025],             ARRAY[1003, 1077, 1118]),
    ('AMPLA',                   ARRAY[1362],             ARRAY[]::INTEGER[]),
    ('ASSEFAZ',                 ARRAY[1008],             ARRAY[]::INTEGER[]),
    ('BRADESCO',                ARRAY[1000, 1122],       ARRAY[]::INTEGER[]),
    ('BRB',                     ARRAY[1268],             ARRAY[]::INTEGER[]),
    ('CÂMARA',                  ARRAY[1283],             ARRAY[]::INTEGER[]),
    ('CASSI',                   ARRAY[1009, 1098, 1253], ARRAY[]::INTEGER[]), -- 1253: FASCAL, enviada pela CASSI
    ('CBMDF',                   ARRAY[1210],             ARRAY[]::INTEGER[]),
    ('EVIDA/LUMINAR',           ARRAY[1049],             ARRAY[]::INTEGER[]),
    ('FUSEX',                   ARRAY[1204],             ARRAY[]::INTEGER[]),
    ('GAMA',                    ARRAY[1343, 1344],       ARRAY[]::INTEGER[]),
    ('GDF INAS',                ARRAY[1257],             ARRAY[]::INTEGER[]),
    ('GEAP',                    ARRAY[1282],             ARRAY[]::INTEGER[]),
    ('PF',                      ARRAY[1281],             ARRAY[]::INTEGER[]),
    ('PLAN ASSISTE',            ARRAY[1129, 1355],       ARRAY[]::INTEGER[]),
    ('PMDF',                    ARRAY[1251],             ARRAY[]::INTEGER[]),
    ('POSTAL SAÚDE',            ARRAY[1052],             ARRAY[]::INTEGER[]),
    ('SAÚDE CAIXA',             ARRAY[1101],             ARRAY[]::INTEGER[]),
    ('SIS',                     ARRAY[1197],             ARRAY[]::INTEGER[]),
    ('STF',                     ARRAY[1235],             ARRAY[]::INTEGER[]),
    ('STJ/PRO-SER',             ARRAY[1252],             ARRAY[]::INTEGER[]),
    ('SULAMÉRICA',              ARRAY[1054, 1078],       ARRAY[]::INTEGER[]),
    ('TJDFT',                   ARRAY[1231],             ARRAY[]::INTEGER[]),
    ('TRE',                     ARRAY[1232],             ARRAY[]::INTEGER[]),
    ('TRT',                     ARRAY[1228],             ARRAY[]::INTEGER[]),
    ('TST',                     ARRAY[1227],             ARRAY[]::INTEGER[]),
    -- AFFEGO, SERPRO, BACEN, STM, CASEMBRAPA, TRF – PRO SOCIAL, CASEC, UNAFISCO, CONAB
    -- (com as variantes "MEDICINA LABORATORIAL" e "BACEN AMH").
    ('AMHPDF – Online',         ARRAY[1025],
     ARRAY[1014, 1136, 1042, 1128, 1135, 1003, 1077, 1118, 1039, 1008, 1036, 1018, 1033, 1009, 1148]),
    -- AFEB, LIFE EMPRESARIAL, ASETE, NOTRE DAME, CAEME, OMINT, FAPES, PROASA, CNTI,
    -- PETROBRAS, EMBRATEL – TELOS, CARE PLUS, GRAVIA.
    ('AMHPDF – Entrega física', ARRAY[1025],
     ARRAY[1010, 1050, 1017, 1022, 1072, 1019, 1049, 1021, 1043, 1121, 1023, 1047, 1048, 1054, 1058, 1150, 1052, 1145])
  ) AS v(convenio, fontes, convenios)
 WHERE r.convenio = v.convenio
   AND r.fontes_pagadoras = '{}'
   AND r.convenios_aplis = '{}';

-- ─── Um lote, um agendamento ──────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS fat_envio_agendamentos_lote_aplis_idx
  ON public.fat_envio_agendamentos (lote_aplis_confirmado)
  WHERE lote_aplis_confirmado IS NOT NULL;

-- ─── Gravação das confirmações ────────────────────────────────────────────────
-- p_confirmacoes: [{ agendamento_id, id_lote, data_envio, marcar }]. Devolve os ids
-- dos agendamentos que mudaram.

CREATE OR REPLACE FUNCTION public.fat_envio_confirmar_aplis(p_confirmacoes JSONB)
RETURNS SETOF UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('fat_envio_confirmar_aplis'));
  -- Em READ COMMITTED, o UPDATE abaixo tira o retrato depois da trava.
  RETURN QUERY
  UPDATE public.fat_envio_agendamentos a
     SET lote_aplis_confirmado = c.id_lote,
         confirmado_em = NOW(),
         data_envio = CASE WHEN c.marcar AND a.data_envio IS NULL THEN c.data_envio ELSE a.data_envio END
    FROM jsonb_to_recordset(p_confirmacoes) AS c(agendamento_id UUID, id_lote INTEGER, data_envio DATE, marcar BOOLEAN)
   WHERE a.id = c.agendamento_id
     AND a.lote_aplis_confirmado IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.fat_envio_agendamentos x WHERE x.lote_aplis_confirmado = c.id_lote)
  RETURNING a.id;
END;
$$;

REVOKE ALL ON FUNCTION public.fat_envio_confirmar_aplis(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fat_envio_confirmar_aplis(JSONB) TO service_role;
