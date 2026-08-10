-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber — previsão de pagamento
-- Migration: 20260807150000_previsao_pagamento.sql
--
-- Depende de 20260807140000_dashboard_receber_filtros.sql.
--
-- Três coisas, todas em volta da mesma pergunta: quanto tempo a operadora leva
-- para pagar, e quanto ela DEVERIA levar.
--
--  1. As regras contratuais de prazo viram dado. `operadoras.prazo_pagamento_dias`
--     só sabe dizer "N dias corridos", e metade das regras reais não é assim:
--     "dia 20 do mês subsequente", "até o 20º dia útil", "último dia do mês
--     subsequente". Entram um catálogo (fat_regra_prazo) e três colunas em
--     operadoras, com a regra aplicada por nome — inclusive nas operadoras que a
--     sync do apLIS criar depois desta migration.
--
--  2. fat_prever_pagamento() resolve qualquer uma dessas regras numa data. É a
--     ÚNICA implementação: o vencimento do título (api/.../titulo-criar) e o
--     dashboard passam a chamar a mesma função, em vez de cada um somar dias
--     do seu jeito.
--
--  3. O dashboard ganha o prazo REAL, medido do envio do lote até o primeiro
--     recebimento do título — simples e ponderado pelo valor recebido — junto do
--     prazo previsto pelo contrato, para os dois serem lidos lado a lado.
--
-- AUTOSSUFICIENTE (IF NOT EXISTS / OR REPLACE em tudo): há drift conhecido entre
-- eqz (test) e jqx (prod).
-- ═══════════════════════════════════════════════════════════════════════════════

-- Checa fat_criar_titulo, e não a versão anterior de fat_dashboard_receber: esta
-- migration DROPA aquela assinatura, então usá-la como pré-condição faria a
-- segunda execução falhar.
DO $$
BEGIN
  IF to_regprocedure('public.fat_criar_titulo(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'fat_criar_titulo(JSONB) não existe. Aplique 20260807120000 e 20260807130000 antes desta migration.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. CALENDÁRIO
-- ═══════════════════════════════════════════════════════════════════════════════

-- Dia útil aqui é "não é sábado nem domingo". NÃO há calendário de feriados: um
-- feriado nacional empurra o pagamento em 1 dia e a previsão erra por 1 dia, o
-- que é irrelevante para um indicador de prazo médio — e manter uma tabela de
-- feriados (móveis, estaduais, bancários) custaria muito mais do que corrige.
CREATE OR REPLACE FUNCTION public.fat_proximo_dia_util(p_data DATE)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE EXTRACT(ISODOW FROM p_data)
           WHEN 6 THEN p_data + 2   -- sábado  → segunda
           WHEN 7 THEN p_data + 1   -- domingo → segunda
           ELSE p_data
         END;
$$;

COMMENT ON FUNCTION public.fat_proximo_dia_util(DATE) IS 'Primeiro dia útil a partir da data (só fins de semana; sem calendário de feriados).';

CREATE OR REPLACE FUNCTION public.fat_somar_dias_uteis(p_data DATE, p_n INTEGER)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_data   DATE    := p_data;
  v_restam INTEGER := GREATEST(COALESCE(p_n, 0), 0);
BEGIN
  IF p_data IS NULL THEN
    RETURN NULL;
  END IF;

  -- Laço e não aritmética fechada porque o número de dias úteis é sempre
  -- pequeno (a maior regra em uso é 20) e a versão legível vale mais aqui.
  WHILE v_restam > 0 LOOP
    v_data := v_data + 1;
    IF EXTRACT(ISODOW FROM v_data) < 6 THEN
      v_restam := v_restam - 1;
    END IF;
  END LOOP;

  RETURN v_data;
END;
$$;

COMMENT ON FUNCTION public.fat_somar_dias_uteis(DATE, INTEGER) IS 'Soma N dias úteis a uma data (só fins de semana; sem calendário de feriados).';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. AS REGRAS DE PRAZO
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fat_regra_prazo (
  nome_chave TEXT PRIMARY KEY,        -- nome da operadora normalizado
  tipo       TEXT    NOT NULL,
  dias       INTEGER,
  descricao  TEXT    NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.fat_regra_prazo IS 'Catálogo de regras contratuais de prazo por operadora, casado por nome normalizado. Semente da regra de cada operadora nova.';

-- Os cinco formatos que as regras em uso assumem. `dias` muda de sentido
-- conforme o tipo, por isso o CHECK exige que ele exista onde é obrigatório.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'public.fat_regra_prazo'::regclass AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.fat_regra_prazo DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.fat_regra_prazo ADD CONSTRAINT fat_regra_prazo_tipo_check CHECK (
  (tipo = 'dias_corridos'                       AND dias IS NOT NULL) OR
  (tipo = 'dias_uteis'                          AND dias IS NOT NULL) OR
  (tipo = 'dia_do_mes_subsequente'              AND dias BETWEEN 1 AND 31) OR
  (tipo = 'ultimo_dia_mes_subsequente') OR
  (tipo = 'dias_apos_primeiro_util'             AND dias IS NOT NULL) OR
  (tipo = 'dias_apos_primeiro_util_subsequente' AND dias IS NOT NULL)
);

-- ─── Colunas em operadoras ────────────────────────────────────────────────────
-- A regra fica NA operadora, e não só no catálogo: o financeiro precisa poder
-- ajustar uma operadora específica sem mexer no catálogo, que é semente.
ALTER TABLE operadoras ADD COLUMN IF NOT EXISTS regra_prazo_tipo      TEXT;
ALTER TABLE operadoras ADD COLUMN IF NOT EXISTS regra_prazo_dias      INTEGER;
ALTER TABLE operadoras ADD COLUMN IF NOT EXISTS regra_prazo_descricao TEXT;

ALTER TABLE operadoras DROP CONSTRAINT IF EXISTS operadoras_regra_prazo_tipo_check;
ALTER TABLE operadoras ADD CONSTRAINT operadoras_regra_prazo_tipo_check CHECK (
  regra_prazo_tipo IS NULL OR regra_prazo_tipo IN (
    'dias_corridos', 'dias_uteis', 'dia_do_mes_subsequente',
    'ultimo_dia_mes_subsequente', 'dias_apos_primeiro_util',
    'dias_apos_primeiro_util_subsequente')
);

COMMENT ON COLUMN operadoras.regra_prazo_tipo IS 'Formato da regra contratual de prazo. NULL = cai em prazo_pagamento_dias (dias corridos).';
COMMENT ON COLUMN operadoras.regra_prazo_dias IS 'Parâmetro da regra: nº de dias, ou o dia do mês nos tipos *_mes_subsequente.';
COMMENT ON COLUMN operadoras.regra_prazo_descricao IS 'A regra como o contrato a escreve. É o que a tela mostra.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. RESOLUÇÃO DA REGRA EM DATA
-- ═══════════════════════════════════════════════════════════════════════════════

-- A base é sempre a data de ENTREGA da cobrança à operadora — na prática, a data
-- de envio do lote. As regras dizem "após a entrega", "após a NF", "após o
-- recebimento da fatura": são todas o mesmo instante do nosso lado.
CREATE OR REPLACE FUNCTION public.fat_prever_pagamento(
  p_tipo TEXT,
  p_dias INTEGER,
  p_base DATE
)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_n         INTEGER := COALESCE(p_dias, 0);
  v_dia1      DATE;    -- 1º dia do mês subsequente à base
BEGIN
  IF p_base IS NULL THEN
    RETURN NULL;
  END IF;

  v_dia1 := (date_trunc('month', p_base) + INTERVAL '1 month')::DATE;

  CASE COALESCE(p_tipo, 'dias_corridos')
    WHEN 'dias_corridos' THEN
      RETURN p_base + v_n;

    WHEN 'dias_uteis' THEN
      RETURN fat_somar_dias_uteis(p_base, v_n);

    -- "Dia 20 do mês subsequente". O LEAST protege o dia 31 em fevereiro.
    WHEN 'dia_do_mes_subsequente' THEN
      RETURN LEAST(
        v_dia1 + (GREATEST(v_n, 1) - 1),
        (v_dia1 + INTERVAL '1 month' - INTERVAL '1 day')::DATE
      );

    WHEN 'ultimo_dia_mes_subsequente' THEN
      RETURN (v_dia1 + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    -- "30 dias após o 1º dia útil de recebimento da NF"
    WHEN 'dias_apos_primeiro_util' THEN
      RETURN fat_proximo_dia_util(p_base) + v_n;

    -- "10 dias contados do 1º dia útil do mês subsequente da NF"
    WHEN 'dias_apos_primeiro_util_subsequente' THEN
      RETURN fat_proximo_dia_util(v_dia1) + v_n;

    -- Tipo desconhecido (regra cadastrada à mão fora da lista): trata como dias
    -- corridos em vez de devolver NULL e sumir com o título do indicador.
    ELSE
      RETURN p_base + v_n;
  END CASE;
END;
$$;

COMMENT ON FUNCTION public.fat_prever_pagamento(TEXT, INTEGER, DATE) IS 'Resolve uma regra contratual de prazo numa data de pagamento prevista.';

CREATE OR REPLACE FUNCTION public.fat_prever_pagamento_operadora(
  p_operadora UUID,
  p_base      DATE
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo  TEXT;
  v_dias  INTEGER;
  v_prazo INTEGER;
BEGIN
  IF p_base IS NULL OR p_operadora IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT regra_prazo_tipo, regra_prazo_dias, prazo_pagamento_dias
    INTO v_tipo, v_dias, v_prazo
    FROM operadoras
   WHERE id_operadora = p_operadora;

  -- Sem regra cadastrada, o comportamento antigo continua valendo: os dias
  -- corridos do cadastro (default 30).
  IF NOT FOUND OR v_tipo IS NULL THEN
    RETURN p_base + COALESCE(v_prazo, 30);
  END IF;

  RETURN fat_prever_pagamento(v_tipo, v_dias, p_base);
END;
$$;

COMMENT ON FUNCTION public.fat_prever_pagamento_operadora(UUID, DATE) IS 'Data prevista de pagamento de uma operadora a partir da entrega da cobrança.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. CASAMENTO DA REGRA COM A OPERADORA
-- ═══════════════════════════════════════════════════════════════════════════════

-- Os nomes vêm de fatinstituicao e raramente batem letra a letra com a planilha
-- do financeiro ("SAÚDE CAIXA" × "SAUDE CAIXA", "STF-MED" × "STF MED").
CREATE OR REPLACE FUNCTION public.fat_normalizar_nome(p_nome TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT btrim(regexp_replace(
    translate(upper(COALESCE(p_nome, '')),
              'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
              'AAAAAEEEEIIIIOOOOOUUUUCN'),
    '[^A-Z0-9]+', ' ', 'g'));
$$;

COMMENT ON FUNCTION public.fat_normalizar_nome(TEXT) IS 'Nome de operadora em caixa alta, sem acento e sem pontuação, para casar com fat_regra_prazo.';

-- Igualdade OU prefixo terminado em espaço. O prefixo é o que faz "AMIL
-- ASSISTENCIA MEDICA INTERNACIONAL SA" casar com AMIL; exigir o espaço é o que
-- impede "TRE" de casar com um "TREMBEMBE" qualquer. Empate resolve pela chave
-- mais longa, para "SIS SENADO" ganhar de um eventual "SIS".
CREATE OR REPLACE FUNCTION public.fat_regra_prazo_de(p_nome TEXT)
RETURNS public.fat_regra_prazo
LANGUAGE sql
STABLE
AS $$
  SELECT r.*
    FROM public.fat_regra_prazo r
   WHERE public.fat_normalizar_nome(p_nome) = r.nome_chave
      OR public.fat_normalizar_nome(p_nome) LIKE r.nome_chave || ' %'
   ORDER BY length(r.nome_chave) DESC
   LIMIT 1;
$$;

-- Aplica a semente em toda operadora que ainda não tem regra própria — inclusive
-- nas que a sync do apLIS criar depois. Trigger, e não uma alteração em
-- fat_criar_titulo: a operadora nasce em três caminhos diferentes (título,
-- operadoras-sync, cadastro manual) e todos passam por aqui.
CREATE OR REPLACE FUNCTION public.fat_operadora_aplicar_regra()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regra public.fat_regra_prazo;
BEGIN
  IF NEW.regra_prazo_tipo IS NOT NULL THEN
    RETURN NEW;  -- já tem regra (do catálogo ou ajustada à mão): não mexe
  END IF;

  v_regra := public.fat_regra_prazo_de(NEW.nome);
  IF v_regra.nome_chave IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.regra_prazo_tipo      := v_regra.tipo;
  NEW.regra_prazo_dias      := v_regra.dias;
  NEW.regra_prazo_descricao := v_regra.descricao;

  -- Mantém o campo antigo coerente com a regra onde ele consegue expressá-la.
  -- Nos outros tipos ele fica como está e serve só de fallback.
  IF v_regra.tipo = 'dias_corridos' THEN
    NEW.prazo_pagamento_dias := v_regra.dias;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_operadora_regra_prazo ON operadoras;
CREATE TRIGGER trigger_operadora_regra_prazo
  BEFORE INSERT OR UPDATE OF nome, regra_prazo_tipo ON operadoras
  FOR EACH ROW EXECUTE FUNCTION public.fat_operadora_aplicar_regra();

-- ─── Semente ──────────────────────────────────────────────────────────────────
-- Planilha do financeiro. `descricao` é o texto do contrato, palavra por palavra:
-- é ele que a tela mostra, e traduzir estraga a conferência.
INSERT INTO public.fat_regra_prazo (nome_chave, tipo, dias, descricao) VALUES
  ('ASSEFAZ',      'dia_do_mes_subsequente',              20,   'Dia 20 do mês subsequente da fatura'),
  ('AMIL',         'dias_corridos',                       30,   '30 dias após entrega'),
  ('BRADESCO',     'dias_corridos',                       45,   '45 dias após receber fatura'),
  ('BRB',          'dias_corridos',                       60,   '60 dias'),
  ('CAMARA',       'dias_corridos',                       60,   '60 dias'),
  ('CASSI',        'dias_corridos',                       30,   '30 dias'),
  ('CBMDF',        'dias_corridos',                       30,   '30 dias após NF'),
  ('E VIDA',       'dias_corridos',                       35,   '35 dias'),
  ('FASCAL',       'dias_uteis',                          20,   'Até o 20º dia útil após o recebimento da fatura'),
  ('FUSEX',        'dias_corridos',                       60,   '60 dias'),
  ('GAMA',         'dias_corridos',                       60,   '60 dias'),
  ('GEAP',         'dias_corridos',                       90,   '90 dias'),
  ('INAS',         'dias_corridos',                       30,   '30 dias'),
  ('PF',           'ultimo_dia_mes_subsequente',          NULL, 'Até o último dia do mês subsequente'),
  ('PLAN ASSISTE', 'dias_corridos',                       30,   '30 dias'),
  ('PMDF',         'dias_corridos',                       30,   '30 dias após NF'),
  ('POSTAL SAUDE', 'dias_corridos',                       60,   'Até 60 dias'),
  ('SAUDE CAIXA',  'dias_corridos',                       30,   '30 dias'),
  ('SIS SENADO',   'dias_corridos',                       60,   '60 dias'),
  ('STF MED',      'dias_apos_primeiro_util',             30,   '30 dias após o 1º dia útil de recebimento da NF'),
  ('STJ',          'dias_apos_primeiro_util_subsequente', 10,   '10 dias contados do 1º dia útil do mês subsequente da NF'),
  ('SUL AMERICA',  'dias_corridos',                       35,   '35 dias'),
  ('TJDFT',        'dias_corridos',                       30,   '30 dias após NF'),
  ('TRE',          'dias_corridos',                       30,   '30 dias após NF'),
  ('TRT',          'dias_corridos',                       30,   '30 dias após NF'),
  ('TST',          'dia_do_mes_subsequente',              20,   '20º dia do mês subsequente'),
  ('AMH',          'dias_corridos',                       60,   '60 dias após o faturamento')
ON CONFLICT (nome_chave) DO UPDATE
  SET tipo      = EXCLUDED.tipo,
      dias      = EXCLUDED.dias,
      descricao = EXCLUDED.descricao;

-- ─── Backfill ─────────────────────────────────────────────────────────────────
-- As operadoras já existentes nasceram com prazo_pagamento_dias = 30 (o default
-- da tabela), que para GEAP significa errar a previsão em dois meses. A planilha
-- é a fonte autoritativa e sobrescreve esse default.
UPDATE operadoras o
   SET regra_prazo_tipo      = r.tipo,
       regra_prazo_dias      = r.dias,
       regra_prazo_descricao = r.descricao,
       prazo_pagamento_dias  = CASE WHEN r.tipo = 'dias_corridos'
                                    THEN r.dias ELSE o.prazo_pagamento_dias END,
       updated_at            = NOW()
  FROM public.fat_regra_prazo r
 WHERE o.regra_prazo_tipo IS NULL
   AND (public.fat_normalizar_nome(o.nome) = r.nome_chave
        OR public.fat_normalizar_nome(o.nome) LIKE r.nome_chave || ' %')
   -- Se dois prefixos casarem, vence o mais específico.
   AND length(r.nome_chave) = (
         SELECT MAX(length(r2.nome_chave)) FROM public.fat_regra_prazo r2
          WHERE public.fat_normalizar_nome(o.nome) = r2.nome_chave
             OR public.fat_normalizar_nome(o.nome) LIKE r2.nome_chave || ' %');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. PRAZO REALIZADO POR TÍTULO
--
-- Uma função à parte porque o dashboard precisa dela duas vezes (nos KPIs e no
-- quadro por operadora) e repetir o encadeamento de CTEs nas duas garantiria que
-- uma das cópias divergisse.
--
-- Uma linha por título de p_ids, com:
--   data_envio     — o envio MAIS RECENTE entre os lotes do título. É quando a
--                    cobrança inteira chegou à operadora; o prazo contratual só
--                    começa a correr aí.
--   dias_previstos — o que o contrato promete, em dias, para esse mesmo envio.
--   dias_reais     — até o PRIMEIRO recebimento do título. NULL quando ainda não
--                    houve baixa (título novo não conta como demora) ou quando o
--                    lote não tem data de envio.
--   peso           — o valor recebido nessa primeira data, para a média
--                    ponderada. Somado, porque duas baixas no mesmo dia são um
--                    pagamento só.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fat_prazos_titulos(p_ids UUID[])
RETURNS TABLE (
  id_nota        UUID,
  operadora_id   UUID,
  data_envio     DATE,
  dias_previstos INTEGER,
  dias_reais     INTEGER,
  peso           NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH envio AS (
    SELECT nl.id_nota, MAX(l.data_envio) AS data_envio
      FROM nota_lote nl
      JOIN lotes l ON l.id_lote = nl.id_lote
     WHERE nl.id_nota = ANY(p_ids)
       AND l.data_envio IS NOT NULL
     GROUP BY nl.id_nota
  ),
  primeira AS (
    SELECT r.nota_id, MIN(r.data_receb) AS data_receb
      FROM recebimentos r
     WHERE r.nota_id = ANY(p_ids)
       AND r.status IN ('recebido', 'parcial')
       AND r.data_receb IS NOT NULL
     GROUP BY r.nota_id
  )
  SELECT n.id_nota,
         n.operadora_id,
         e.data_envio,
         (public.fat_prever_pagamento_operadora(n.operadora_id, e.data_envio) - e.data_envio)::INTEGER,
         -- Baixa datada ANTES do envio é erro de digitação, não prazo negativo:
         -- um único registro assim puxaria a média inteira para baixo.
         CASE WHEN p.data_receb >= e.data_envio THEN (p.data_receb - e.data_envio)::INTEGER END,
         CASE WHEN p.data_receb >= e.data_envio THEN (
           SELECT COALESCE(SUM(r2.valor_recebido), 0)
             FROM recebimentos r2
            WHERE r2.nota_id = n.id_nota
              AND r2.status IN ('recebido', 'parcial')
              AND r2.data_receb = p.data_receb
         ) END
    FROM notas n
    LEFT JOIN envio    e ON e.id_nota = n.id_nota
    LEFT JOIN primeira p ON p.nota_id = n.id_nota
   WHERE n.id_nota = ANY(p_ids);
$$;

COMMENT ON FUNCTION public.fat_prazos_titulos(UUID[]) IS 'Prazo previsto e realizado (envio do lote → primeiro recebimento) de cada título.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. DASHBOARD
--
-- Duas mudanças sobre a versão anterior:
--
--  a) os filtros viram LISTAS. Operadora, lote e nota fiscal aceitam vários
--     valores; dentro de um campo os valores são OR, entre campos é AND
--     ("AMIL ou GEAP, e lote 6423 ou 6424"). Lista vazia = campo sem filtro.
--
--  b) entram em `kpis` os três prazos (previsto, médio, ponderado) e, no topo,
--     o `previsaoOperadoras`: a mesma leitura quebrada por operadora, com a
--     regra do contrato ao lado, que é onde se vê QUEM atrasa.
--
-- A assinatura muda em (a), então o DROP das versões anteriores é obrigatório:
-- conviver com elas deixaria a chamada por parâmetro nomeado ambígua.
-- ═══════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.fat_dashboard_receber(DATE, DATE, UUID);
DROP FUNCTION IF EXISTS public.fat_dashboard_receber(DATE, DATE, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.fat_dashboard_receber(
  p_desde      DATE,
  p_ate        DATE,
  p_operadoras UUID[] DEFAULT NULL,
  p_lotes      TEXT[] DEFAULT NULL,
  p_notas      TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids         UUID[];
  v_ids_periodo UUID[];
  v_operadoras_f UUID[];
  v_lotes       TEXT[];
  v_notas       TEXT[];
  v_kpis        JSONB;
  v_prazos      JSONB;
  v_aging       JSONB;
  v_operadoras  JSONB;
  v_previsao    JSONB;
  v_serie       JSONB;
BEGIN
  IF NOT (public.current_user_has_permission('canViewBilling')
          OR public.current_user_has_permission('canManageBilling')) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar faturamento.' USING ERRCODE = '42501';
  END IF;

  -- Termos limpos uma vez só: em minúsculas, sem espaços nas pontas e sem os
  -- vazios que um campo de chips deixa passar (um chip só de espaços zeraria a
  -- tela ao não casar com nada).
  v_operadoras_f := ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_operadoras, '{}'::UUID[])) AS x
                           WHERE x IS NOT NULL);
  v_lotes        := ARRAY(SELECT DISTINCT lower(btrim(x)) FROM unnest(COALESCE(p_lotes, '{}'::TEXT[])) AS x
                           WHERE btrim(COALESCE(x, '')) <> '');
  v_notas        := ARRAY(SELECT DISTINCT lower(btrim(x)) FROM unnest(COALESCE(p_notas, '{}'::TEXT[])) AS x
                           WHERE btrim(COALESCE(x, '')) <> '');

  -- Universo da tela, resolvido uma vez só. Sem recorte de data: cada seção
  -- aplica o seu (o aging olha a carteira inteira, os KPIs olham o período).
  --
  -- POSITION em vez de ILIKE de propósito: o texto vem cru do operador e `%` ou
  -- `_` digitados no número da nota viram curinga silencioso no LIKE.
  SELECT COALESCE(array_agg(n.id_nota), '{}')
    INTO v_ids
    FROM notas n
   WHERE n.status <> 'cancelada'
     AND (cardinality(v_operadoras_f) = 0 OR n.operadora_id = ANY(v_operadoras_f))
     AND (cardinality(v_notas) = 0 OR EXISTS (
           SELECT 1 FROM unnest(v_notas) AS termo
            WHERE POSITION(termo IN lower(n.numero_nota)) > 0
         ))
     AND (cardinality(v_lotes) = 0 OR EXISTS (
           SELECT 1
             FROM nota_lote nl
             JOIN lotes l ON l.id_lote = nl.id_lote
             CROSS JOIN unnest(v_lotes) AS termo
            WHERE nl.id_nota = n.id_nota
              AND (POSITION(termo IN lower(l.codigo_lote)) > 0
                   OR POSITION(termo IN lower(COALESCE(l.aplis_id, ''))) > 0)
         ));

  -- Recorte da emissão, usado pelos KPIs, pelos prazos e pela série mensal.
  SELECT COALESCE(array_agg(n.id_nota), '{}')
    INTO v_ids_periodo
    FROM notas n
   WHERE n.id_nota = ANY(v_ids)
     AND n.data_emissao BETWEEN p_desde AND p_ate;

  -- ─── KPIs de valor ──────────────────────────────────────────────────────────
  -- Recortados pela emissão, para fecharem com o gráfico de série mensal: os
  -- quatro cards são exatamente a soma das barras que aparecem logo abaixo.
  WITH titulos AS (
    SELECT n.id_nota, n.valor_total, n.valor_recebido, n.valor_glosado
      FROM notas n
     WHERE n.id_nota = ANY(v_ids_periodo)
  )
  SELECT jsonb_build_object(
    'faturado',   (SELECT COALESCE(SUM(valor_total), 0)    FROM titulos),
    'recebido',   (SELECT COALESCE(SUM(valor_recebido), 0) FROM titulos),
    'glosado',    (SELECT COALESCE(SUM(valor_glosado), 0)  FROM titulos),
    'acatado',    (SELECT COALESCE(SUM(g.valor), 0)
                     FROM glosas g
                    WHERE g.nota_id IN (SELECT id_nota FROM titulos)
                      AND g.status = 'definitiva'),
    'qtdTitulos', (SELECT COUNT(*) FROM titulos)
  ) INTO v_kpis;

  -- ─── KPIs de prazo ──────────────────────────────────────────────────────────
  -- Todos NULL quando nenhum título do período tem envio + recebimento: a tela
  -- mostra "—" em vez de um zero que leria como "pagam no mesmo dia".
  SELECT jsonb_build_object(
    'prazoPrevistoDias',  ROUND(AVG(dias_previstos)::NUMERIC, 1),
    'prazoMedioDias',     ROUND(AVG(dias_reais)::NUMERIC, 1),
    -- Ponderada pelo valor: um título de R$ 200 mil pago em 90 dias diz mais
    -- sobre o caixa do que dez títulos de R$ 500 pagos em 20.
    'prazoPonderadoDias', ROUND((SUM(dias_reais * peso) / NULLIF(SUM(peso), 0))::NUMERIC, 1),
    'prazoBaseTitulos',   COUNT(*) FILTER (WHERE dias_reais IS NOT NULL)
  ) INTO v_prazos
  FROM public.fat_prazos_titulos(v_ids_periodo);

  v_kpis := v_kpis || v_prazos;

  -- ─── Aging ──────────────────────────────────────────────────────────────────
  -- Sem recorte de data: um título vencido há seis meses é justamente o que mais
  -- importa ver. 'a_vencer' junta o que ainda não venceu com o que não tem
  -- vencimento definido — não é atraso, é dado faltando.
  SELECT jsonb_build_object(
    'a_vencer', COALESCE(SUM(valor_saldo) FILTER (WHERE atraso IS NULL OR atraso <= 0), 0),
    'd1_30',    COALESCE(SUM(valor_saldo) FILTER (WHERE atraso BETWEEN 1 AND 30), 0),
    'd31_60',   COALESCE(SUM(valor_saldo) FILTER (WHERE atraso BETWEEN 31 AND 60), 0),
    'd61_90',   COALESCE(SUM(valor_saldo) FILTER (WHERE atraso BETWEEN 61 AND 90), 0),
    'd90_mais', COALESCE(SUM(valor_saldo) FILTER (WHERE atraso > 90), 0)
  ) INTO v_aging
  FROM (
    SELECT n.valor_saldo, (CURRENT_DATE - n.data_vencimento) AS atraso
      FROM notas n
     WHERE n.id_nota = ANY(v_ids)
       AND n.status NOT IN ('recebida', 'liquidada')
       AND n.valor_saldo > 0
  ) t;

  SELECT COALESCE(jsonb_agg(linha ORDER BY (linha->>'saldo')::NUMERIC DESC), '[]'::jsonb)
    INTO v_operadoras
    FROM (
      SELECT jsonb_build_object(
               'operadoraId',    o.id_operadora,
               'nome',           o.nome,
               'saldo',          COALESCE(SUM(n.valor_saldo), 0),
               'qtdTitulos',     COUNT(n.id_nota),
               'faturado',       COALESCE(SUM(n.valor_total), 0),
               'glosado',        COALESCE(SUM(n.valor_glosado), 0),
               'percentualGlosa', CASE WHEN COALESCE(SUM(n.valor_total), 0) > 0
                                       THEN ROUND(100 * SUM(n.valor_glosado) / SUM(n.valor_total), 1)
                                       ELSE 0 END
             ) AS linha
        FROM operadoras o
        JOIN notas n ON n.operadora_id = o.id_operadora
       WHERE n.id_nota = ANY(v_ids)
       GROUP BY o.id_operadora, o.nome
    ) s;

  -- ─── Previsão por operadora ─────────────────────────────────────────────────
  -- Mesma base dos KPIs de prazo (títulos emitidos no período), quebrada por
  -- operadora e com a regra do contrato ao lado. `base` é quantos títulos
  -- realmente tinham envio e recebimento: sem esse número, "0 dias" e "sem
  -- histórico" seriam indistinguíveis na tela.
  SELECT COALESCE(jsonb_agg(linha ORDER BY linha->>'nome'), '[]'::jsonb)
    INTO v_previsao
    FROM (
      SELECT jsonb_build_object(
               'operadoraId',    o.id_operadora,
               'nome',           o.nome,
               'regra',          o.regra_prazo_descricao,
               'qtdTitulos',     COUNT(*),
               'prazoPrevisto',  ROUND(AVG(pz.dias_previstos)::NUMERIC, 1),
               'prazoMedio',     ROUND(AVG(pz.dias_reais)::NUMERIC, 1),
               'prazoPonderado', ROUND((SUM(pz.dias_reais * pz.peso)
                                        / NULLIF(SUM(pz.peso), 0))::NUMERIC, 1),
               'base',           COUNT(pz.dias_reais)
             ) AS linha
        FROM public.fat_prazos_titulos(v_ids_periodo) pz
        JOIN operadoras o ON o.id_operadora = pz.operadora_id
       GROUP BY o.id_operadora, o.nome, o.regra_prazo_descricao
    ) s;

  -- Faturado × recebido × glosado por competência, recortado pela emissão.
  SELECT COALESCE(jsonb_agg(linha ORDER BY linha->>'competencia'), '[]'::jsonb)
    INTO v_serie
    FROM (
      SELECT jsonb_build_object(
               'competencia', COALESCE(n.competencia, to_char(n.data_emissao, 'YYYY-MM')),
               'faturado',    COALESCE(SUM(n.valor_total), 0),
               'recebido',    COALESCE(SUM(n.valor_recebido), 0),
               'glosado',     COALESCE(SUM(n.valor_glosado), 0)
             ) AS linha
        FROM notas n
       WHERE n.id_nota = ANY(v_ids_periodo)
       GROUP BY COALESCE(n.competencia, to_char(n.data_emissao, 'YYYY-MM'))
    ) s;

  RETURN jsonb_build_object(
    'kpis',               v_kpis,
    'aging',              v_aging,
    'porOperadora',       v_operadoras,
    'previsaoOperadoras', v_previsao,
    'serieMensal',        v_serie
  );
END;
$$;

COMMENT ON FUNCTION public.fat_dashboard_receber(DATE, DATE, UUID[], TEXT[], TEXT[]) IS
  'Dashboard de contas a receber: faturado/recebido/glosado/acatado e prazos previsto/médio/ponderado do período, aging da carteira, recorte por operadora e série mensal. Filtros de operadora, lote e nota aceitam vários valores (OR dentro do campo, AND entre campos).';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. VENCIMENTO DO TÍTULO NOVO
--
-- Chamada por api/_lib/handlers/faturamento-titulo-criar.ts, que antes lia
-- prazo_pagamento_dias e somava os dias em TypeScript. Passa a delegar a conta
-- para cá, para as regras terem uma implementação só.
--
-- Recebe o aplis_id porque no primeiro título de uma operadora ela ainda não
-- existe no FlowLab: nesse caso a regra é resolvida direto do catálogo pelo nome
-- que veio do apLIS.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fat_prever_vencimento(
  p_aplis_id TEXT,
  p_nome     TEXT,
  p_base     DATE
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operadora UUID;
  v_regra     public.fat_regra_prazo;
BEGIN
  IF p_base IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id_operadora INTO v_operadora
    FROM operadoras
   WHERE aplis_id = NULLIF(btrim(COALESCE(p_aplis_id, '')), '');

  IF FOUND THEN
    RETURN fat_prever_pagamento_operadora(v_operadora, p_base);
  END IF;

  v_regra := public.fat_regra_prazo_de(p_nome);
  IF v_regra.nome_chave IS NULL THEN
    RETURN p_base + 30;  -- mesmo default de antes (PRAZO_PADRAO_DIAS)
  END IF;

  RETURN fat_prever_pagamento(v_regra.tipo, v_regra.dias, p_base);
END;
$$;

COMMENT ON FUNCTION public.fat_prever_vencimento(TEXT, TEXT, DATE) IS 'Vencimento previsto de um título novo, resolvido pela operadora (por aplis_id) ou pelo catálogo de regras (por nome).';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. RLS E GRANTS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.fat_regra_prazo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fat_regra_prazo_select_billing ON public.fat_regra_prazo;
CREATE POLICY fat_regra_prazo_select_billing ON public.fat_regra_prazo
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewBilling')
      OR public.current_user_has_permission('canManageBilling'));

DROP POLICY IF EXISTS fat_regra_prazo_write_billing ON public.fat_regra_prazo;
CREATE POLICY fat_regra_prazo_write_billing ON public.fat_regra_prazo
  FOR ALL TO authenticated
  USING (public.current_user_has_permission('canManageBilling'))
  WITH CHECK (public.current_user_has_permission('canManageBilling'));

-- Grants nominais: REVOKE FROM PUBLIC não basta no Supabase, os default
-- privileges já deram EXECUTE explícito a anon/authenticated.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.fat_proximo_dia_util(date)',
    'public.fat_somar_dias_uteis(date,integer)',
    'public.fat_prever_pagamento(text,integer,date)',
    'public.fat_prever_pagamento_operadora(uuid,date)',
    'public.fat_normalizar_nome(text)',
    'public.fat_regra_prazo_de(text)',
    'public.fat_prazos_titulos(uuid[])',
    'public.fat_prever_vencimento(text,text,date)',
    'public.fat_dashboard_receber(date,date,uuid[],text[],text[])'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- A trigger de operadoras é SECURITY DEFINER e roda no INSERT da sync; não
-- precisa de grant (ninguém a chama diretamente).
REVOKE ALL ON FUNCTION public.fat_operadora_aplicar_regra() FROM PUBLIC;
