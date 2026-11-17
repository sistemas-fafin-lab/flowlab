-- ═══════════════════════════════════════════════════════════════════════════════
-- Calendário de envios: vários lotes por agendamento e nenhuma confirmação de data
-- futura (casarLotes, api/_lib/faturamento/calendarioEnvios.ts).
--
-- O problema (SAÚDE CAIXA, novembro/2026): o convênio manda vários lotes por envio e
-- por mês (9 lotes para 4 agendamentos). Com um lote por agendamento, o segundo lote
-- do dia 09/11 foi para o agendamento de 18/11 e o do dia 10/11 para o de 25/11: os dois
-- apareceram como enviados antes de a data chegar.
--
-- 1. fat_envio_agendamentos.lotes_aplis (INTEGER[]) substitui lote_aplis_confirmado:
--    um envio tem vários lotes. A carga copia o lote que já estava gravado. A coluna
--    antiga fica (sem uso, deixa de ser gravada) para a API anterior continuar
--    funcionando entre a migration e o deploy; sai numa migration depois do deploy.
-- 2. Histórico: "confirmou_aplis" grava depois = {"lotes_aplis": [os lotes novos]}. As
--    linhas antigas continuam com {"lote_aplis_confirmado": n}; a tela lê as duas.
-- 3. fat_envio_confirmar_aplis: acrescenta o lote ao agendamento, um por vez, na ordem
--    recebida (a primeira confirmação de um agendamento sem marcação marca). Lote que já
--    está em algum agendamento fica onde está. Uma linha de histórico por lote.
-- 4. Correção: a confirmação automática do mês corrente em diante é desfeita (lotes
--    tirados; o marcado só pela confirmação volta a pendente). O marcado à mão mantém a
--    data informada e perde só os lotes. A próxima abertura do mês casa tudo de novo com
--    a regra nova, sem as datas futuras. Os meses anteriores ficam como estão.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.fat_envio_confirmar_aplis(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Função public.fat_envio_confirmar_aplis não existe. Aplique 20261028190000_fat_envio_confirmacao_aplis.sql antes desta migration.';
  END IF;
END $$;

-- ─── Vários lotes ─────────────────────────────────────────────────────────────

ALTER TABLE public.fat_envio_agendamentos
  ADD COLUMN IF NOT EXISTS lotes_aplis INTEGER[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.fat_envio_agendamentos.lotes_aplis IS
  'Lotes (fatlote.IdLote) do backup do apLIS que confirmaram o envio: o selo "confirmado no apLIS". Um lote fica em um agendamento só (fat_envio_confirmar_aplis).';

UPDATE public.fat_envio_agendamentos
   SET lotes_aplis = ARRAY[lote_aplis_confirmado]
 WHERE lote_aplis_confirmado IS NOT NULL
   AND lotes_aplis = '{}';

CREATE INDEX IF NOT EXISTS fat_envio_agendamentos_lotes_aplis_idx
  ON public.fat_envio_agendamentos USING GIN (lotes_aplis);

-- ─── Histórico ────────────────────────────────────────────────────────────────
-- Igual a 20261028180000, trocando o lote único pelos lotes novos.

CREATE OR REPLACE FUNCTION public.fat_envio_agendamentos_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_por      UUID := auth.uid();
  v_por_nome TEXT := public.fat_envio_nome_usuario();
  v_novos    INTEGER[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.fat_envio_agendamento_historico (agendamento_id, regra_id, data_prevista, acao, depois, por, por_nome)
    VALUES (NEW.id, NEW.regra_id, NEW.data_prevista, 'criou',
            jsonb_build_object('data_prevista', NEW.data_prevista, 'origem', NEW.origem), v_por, v_por_nome);
    IF NEW.data_envio IS NOT NULL THEN
      INSERT INTO public.fat_envio_agendamento_historico (agendamento_id, regra_id, data_prevista, acao, depois, por, por_nome)
      VALUES (NEW.id, NEW.regra_id, NEW.data_prevista, 'marcou', jsonb_build_object('data_envio', NEW.data_envio), v_por, v_por_nome);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.fat_envio_agendamento_historico (agendamento_id, regra_id, data_prevista, acao, antes, depois, por, por_nome)
    VALUES (OLD.id, OLD.regra_id, OLD.data_prevista, 'removeu',
            jsonb_build_object('data_prevista', OLD.data_prevista, 'data_envio', OLD.data_envio, 'origem', OLD.origem),
            CASE WHEN current_setting('fat_envio.pela_sugestao', true) = 'on'
                 THEN jsonb_build_object('pela_sugestao', true) END,
            v_por, v_por_nome);
    RETURN OLD;
  END IF;

  IF NEW.data_prevista IS DISTINCT FROM OLD.data_prevista THEN
    INSERT INTO public.fat_envio_agendamento_historico (agendamento_id, regra_id, data_prevista, acao, antes, depois, por, por_nome)
    VALUES (NEW.id, NEW.regra_id, NEW.data_prevista, 'moveu',
            jsonb_build_object('data_prevista', OLD.data_prevista), jsonb_build_object('data_prevista', NEW.data_prevista), v_por, v_por_nome);
  END IF;

  IF NEW.data_envio IS DISTINCT FROM OLD.data_envio THEN
    INSERT INTO public.fat_envio_agendamento_historico (agendamento_id, regra_id, data_prevista, acao, antes, depois, por, por_nome)
    VALUES (NEW.id, NEW.regra_id, NEW.data_prevista,
            CASE WHEN NEW.data_envio IS NULL THEN 'desmarcou' ELSE 'marcou' END,
            jsonb_build_object('data_envio', OLD.data_envio), jsonb_build_object('data_envio', NEW.data_envio), v_por, v_por_nome);
  END IF;

  SELECT COALESCE(array_agg(l ORDER BY l), '{}') INTO v_novos
    FROM unnest(NEW.lotes_aplis) AS l
   WHERE NOT l = ANY(OLD.lotes_aplis);
  IF cardinality(v_novos) > 0 THEN
    INSERT INTO public.fat_envio_agendamento_historico (agendamento_id, regra_id, data_prevista, acao, antes, depois, por, por_nome)
    VALUES (NEW.id, NEW.regra_id, NEW.data_prevista, 'confirmou_aplis',
            jsonb_build_object('lotes_aplis', OLD.lotes_aplis), jsonb_build_object('lotes_aplis', v_novos), v_por, v_por_nome);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.fat_envio_agendamentos.lote_aplis_confirmado IS
  'Obsoleta (20261117150000): substituída por lotes_aplis. Remover depois do deploy da API que lê lotes_aplis.';

-- ─── Gravação das confirmações ────────────────────────────────────────────────
-- p_confirmacoes: [{ agendamento_id, id_lote, data_envio, marcar }], na ordem do envio.
-- Devolve os ids dos agendamentos que mudaram.

CREATE OR REPLACE FUNCTION public.fat_envio_confirmar_aplis(p_confirmacoes JSONB)
RETURNS SETOF UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c        RECORD;
  v_mudou  UUID[] := '{}';
BEGIN
  -- Duas telas abrindo o mês ao mesmo tempo gravam uma depois da outra: a segunda já
  -- vê os lotes da primeira.
  PERFORM pg_advisory_xact_lock(hashtext('fat_envio_confirmar_aplis'));
  FOR c IN
    SELECT (e.v->>'agendamento_id')::UUID AS agendamento_id,
           (e.v->>'id_lote')::INTEGER     AS id_lote,
           (e.v->>'data_envio')::DATE     AS data_envio,
           (e.v->>'marcar')::BOOLEAN      AS marcar
      FROM jsonb_array_elements(p_confirmacoes) WITH ORDINALITY AS e(v, n)
     ORDER BY e.n
  LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.fat_envio_agendamentos x WHERE x.lotes_aplis @> ARRAY[c.id_lote]
    );
    -- Data prevista futura e sem marcação não se confirma (casarLotes já não pede; a
    -- trava vale também para a API anterior, que roda até o deploy).
    UPDATE public.fat_envio_agendamentos a
       SET lotes_aplis = a.lotes_aplis || c.id_lote,
           confirmado_em = NOW(),
           data_envio = CASE WHEN c.marcar AND a.data_envio IS NULL THEN c.data_envio ELSE a.data_envio END
     WHERE a.id = c.agendamento_id
       AND (a.data_envio IS NOT NULL OR a.data_prevista <= (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE);
    IF FOUND AND NOT c.agendamento_id = ANY(v_mudou) THEN
      v_mudou := v_mudou || c.agendamento_id;
    END IF;
  END LOOP;
  RETURN QUERY SELECT unnest(v_mudou);
END;
$$;

REVOKE ALL ON FUNCTION public.fat_envio_confirmar_aplis(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fat_envio_confirmar_aplis(JSONB) TO service_role;

-- ─── Correção das confirmações já gravadas ───────────────────────────────────
-- Do mês corrente (Brasília) em diante. marcado_por nulo com data de envio = marcado
-- pela confirmação automática; o trigger de histórico grava o "desmarcou".

UPDATE public.fat_envio_agendamentos
   SET lotes_aplis = '{}',
       lote_aplis_confirmado = NULL,
       confirmado_em = NULL,
       data_envio = CASE WHEN marcado_por IS NULL THEN NULL ELSE data_envio END
 WHERE lotes_aplis <> '{}'
   AND data_prevista >= date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
