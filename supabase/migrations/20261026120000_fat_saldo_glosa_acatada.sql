-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber — saldo do título desconta a glosa acatada do apLIS
-- Migration: 20261026120000_fat_saldo_glosa_acatada.sql
--
-- Issue 13 de .scratch/glosas-recursos-dashboard/. Antes (20261022160000):
--   valor_saldo = total − recebido − glosa DEFINITIVA da tabela `glosas`
-- Agora:
--   valor_saldo = total − recebido − glosa ACATADA da foto do apLIS
--
-- Glosa acatada = Σ (líquido − recebido) das requisições da foto
-- (glosa_recurso_requisicoes) em "Recebido a menor – acatado" (18) ou "Glosa
-- definitiva – acatada diretoria" (8), nos lotes de faturamento do título
-- (nota_lote → lotes.aplis_id = id_lote_faturamento). É a mesma regra da
-- coluna "Glosa acatada" da tela (recursoGlosa.classificarRequisicao, classe
-- 'acatada'): um lote ligado a dois títulos conta nos dois.
--
-- O status segue a mesma troca: 'liquidada' quando recebido + acatada cobre o
-- total, 'glosada' quando há glosa acatada sem recebido.
--
-- A tabela `glosas` fica como histórico: o lançamento manual e o do apLIS saem
-- da tela. valor_glosado continua sendo mantido a partir dela (é histórico, e
-- a conferência com o apLIS ainda o mostra), mas não mexe mais no saldo nem
-- no status. valor_glosado_definitivo sai: só existia para o saldo.
--
-- Quem mantém valor_glosa_acatada: fat_recalcular_nota, chamada
--   - pelos gatilhos de baixas e glosas (como antes);
--   - pela foto: um gatilho por comando em glosa_recurso_requisicoes recalcula
--     os títulos dos lotes que a sincronização (ou o lápis) tocou;
--   - por nota_lote: lote que entra ou sai do título muda a glosa acatada dele;
--   - por lotes: aplis_id preenchido ou corrigido depois.
--
-- Fica no banco, sem uso na tela: a tabela `glosas`, a RPC
-- fat_lancar_glosas_aplis e a coluna glosas.origem (histórico).
--
-- Antes de aplicar: supabase/scripts/fat_saldo_glosa_acatada_previa.sql
-- compara o saldo antigo com o novo, título a título.
--
-- Depende de 20260807120000_contas_receber.sql (fat_recalcular_nota) e de
-- 20261023150000_glosa_recurso_foto.sql (foto).
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.glosa_recurso_requisicoes') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.glosa_recurso_requisicoes não existe. Aplique 20261023150000_glosa_recurso_foto.sql antes desta migration.';
  END IF;
END $$;

ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS valor_glosa_acatada DECIMAL(15, 2) DEFAULT 0;

COMMENT ON COLUMN public.notas.valor_glosa_acatada IS
  'Glosa acatada do apLIS nos lotes do título: Σ líquido − recebido das requisições da foto em 18 ou 8. Mantida por fat_recalcular_nota; é o que sai do saldo.';

-- A leitura por lote de faturamento (aqui e na rota titulos-glosas-aplis) não
-- tinha índice.
CREATE INDEX IF NOT EXISTS glosa_recurso_requisicoes_lote_faturamento_idx
  ON public.glosa_recurso_requisicoes (id_lote_faturamento);

-- ─── Glosa acatada de um título ──────────────────────────────────────────────
-- Status 18 e 8: STATUS_ACATADA em api/_lib/faturamento/recursoGlosa.ts.
-- O cast vai do lado de `lotes` (aplis_id é TEXT) para o índice da foto valer;
-- aplis_id que não é número é lote criado fora do apLIS e fica de fora.
CREATE OR REPLACE FUNCTION public.fat_glosa_acatada_nota(p_nota_id UUID)
RETURNS DECIMAL(15, 2)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(r.liquido - r.recebido), 0)::DECIMAL(15, 2)
    FROM glosa_recurso_requisicoes r
   WHERE r.status_aplis IN (18, 8)
     AND r.id_lote_faturamento IN (
       -- IN já ignora duplicata: o mesmo lote do apLIS vinculado duas vezes ao
       -- título (dois snapshots em `lotes`) não conta em dobro.
       SELECT l.aplis_id::INTEGER
         FROM nota_lote nl
         JOIN lotes l ON l.id_lote = nl.id_lote
        WHERE nl.id_nota = p_nota_id
          AND l.aplis_id ~ '^[0-9]{1,9}$'
     );
$$;

COMMENT ON FUNCTION public.fat_glosa_acatada_nota(UUID) IS
  'Glosa acatada do apLIS nos lotes do título (status 18 e 8 da foto, líquido − recebido).';

-- SECURITY DEFINER passa por cima da RLS: só para uso interno (fat_recalcular_nota).
REVOKE ALL ON FUNCTION public.fat_glosa_acatada_nota(UUID) FROM PUBLIC, anon, authenticated;

-- ─── Recálculo do título ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fat_recalcular_nota(p_nota_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total     DECIMAL(15, 2);
  v_recebido  DECIMAL(15, 2);
  v_glosado   DECIMAL(15, 2);
  v_acatada   DECIMAL(15, 2);
  v_cancelada BOOLEAN;
  v_status    TEXT;
BEGIN
  IF p_nota_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(valor_total, 0), status = 'cancelada'
    INTO v_total, v_cancelada
    FROM notas
   WHERE id_nota = p_nota_id;

  -- Título já apagado (CASCADE em andamento): nada a recalcular.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(valor_recebido), 0)
    INTO v_recebido
    FROM recebimentos
   WHERE nota_id = p_nota_id
     AND status IN ('recebido', 'parcial');

  -- Histórico da tabela `glosas`: não entra no saldo nem no status.
  SELECT COALESCE(SUM(valor) FILTER (WHERE status IN ('aberta', 'em_recurso', 'definitiva')), 0)
    INTO v_glosado
    FROM glosas
   WHERE nota_id = p_nota_id;

  v_acatada := fat_glosa_acatada_nota(p_nota_id);

  -- Precedência: cancelada (decisão manual, nada automático a desfaz) >
  -- recebida > liquidada > parcialmente_recebida > glosada > aberta.
  -- O `v_total > 0` impede que um título recém-criado sem valor (0 >= 0) já
  -- nasça anunciando "recebida".
  v_status := CASE
    WHEN v_cancelada                                       THEN 'cancelada'
    WHEN v_total > 0 AND v_recebido >= v_total             THEN 'recebida'
    WHEN v_total > 0 AND v_recebido + v_acatada >= v_total THEN 'liquidada'
    WHEN v_recebido > 0                                    THEN 'parcialmente_recebida'
    WHEN v_acatada > 0                                     THEN 'glosada'
    ELSE                                                        'aberta'
  END;

  UPDATE notas
     SET valor_recebido      = v_recebido,
         valor_glosado       = v_glosado,
         valor_glosa_acatada = v_acatada,
         status              = v_status,
         updated_at          = NOW()
   WHERE id_nota = p_nota_id;
END;
$$;

COMMENT ON FUNCTION public.fat_recalcular_nota(UUID) IS 'Recalcula valor_recebido, valor_glosado (histórico da tabela glosas), valor_glosa_acatada (foto do apLIS) e status de um título.';

-- ─── Gatilho: a foto mudou ───────────────────────────────────────────────────
-- Por comando, não por linha: a sincronização grava milhares de requisições num
-- upsert, e o mesmo título seria recalculado uma vez por requisição. Um gatilho
-- por evento porque tabela de transição não aceita mais de um evento.
CREATE OR REPLACE FUNCTION public.fat_recalcular_notas_da_foto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nota UUID;
BEGIN
  -- Cada ramo lê só as tabelas de transição que o gatilho do evento declara:
  -- o PL/pgSQL prepara a consulta só quando o ramo roda.
  IF TG_OP = 'INSERT' THEN
    FOR v_nota IN
      SELECT DISTINCT nl.id_nota
        FROM (SELECT DISTINCT id_lote_faturamento FROM novas) t
        JOIN lotes l ON l.aplis_id = t.id_lote_faturamento::TEXT
        JOIN nota_lote nl ON nl.id_lote = l.id_lote
    LOOP
      PERFORM fat_recalcular_nota(v_nota);
    END LOOP;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Os dois lados: a requisição pode ter mudado de lote de faturamento.
    FOR v_nota IN
      SELECT DISTINCT nl.id_nota
        FROM (SELECT id_lote_faturamento FROM novas UNION SELECT id_lote_faturamento FROM antigas) t
        JOIN lotes l ON l.aplis_id = t.id_lote_faturamento::TEXT
        JOIN nota_lote nl ON nl.id_lote = l.id_lote
    LOOP
      PERFORM fat_recalcular_nota(v_nota);
    END LOOP;
  ELSE
    FOR v_nota IN
      SELECT DISTINCT nl.id_nota
        FROM (SELECT DISTINCT id_lote_faturamento FROM antigas) t
        JOIN lotes l ON l.aplis_id = t.id_lote_faturamento::TEXT
        JOIN nota_lote nl ON nl.id_lote = l.id_lote
    LOOP
      PERFORM fat_recalcular_nota(v_nota);
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.fat_recalcular_notas_da_foto() IS 'Recalcula os títulos dos lotes de faturamento tocados por um comando na foto de glosas e recursos.';

DROP TRIGGER IF EXISTS trigger_foto_glosa_insert_nota ON public.glosa_recurso_requisicoes;
CREATE TRIGGER trigger_foto_glosa_insert_nota
  AFTER INSERT ON public.glosa_recurso_requisicoes
  REFERENCING NEW TABLE AS novas
  FOR EACH STATEMENT EXECUTE FUNCTION public.fat_recalcular_notas_da_foto();

DROP TRIGGER IF EXISTS trigger_foto_glosa_update_nota ON public.glosa_recurso_requisicoes;
CREATE TRIGGER trigger_foto_glosa_update_nota
  AFTER UPDATE ON public.glosa_recurso_requisicoes
  REFERENCING OLD TABLE AS antigas NEW TABLE AS novas
  FOR EACH STATEMENT EXECUTE FUNCTION public.fat_recalcular_notas_da_foto();

DROP TRIGGER IF EXISTS trigger_foto_glosa_delete_nota ON public.glosa_recurso_requisicoes;
CREATE TRIGGER trigger_foto_glosa_delete_nota
  AFTER DELETE ON public.glosa_recurso_requisicoes
  REFERENCING OLD TABLE AS antigas
  FOR EACH STATEMENT EXECUTE FUNCTION public.fat_recalcular_notas_da_foto();

-- ─── Gatilho: lote entrou ou saiu do título ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.fat_recalcular_nota_do_vinculo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM fat_recalcular_nota(OLD.id_nota);
  END IF;
  IF TG_OP <> 'DELETE'
     AND (TG_OP = 'INSERT' OR NEW.id_nota IS DISTINCT FROM OLD.id_nota OR NEW.id_lote IS DISTINCT FROM OLD.id_lote) THEN
    PERFORM fat_recalcular_nota(NEW.id_nota);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_nota_lote_update_nota ON public.nota_lote;
CREATE TRIGGER trigger_nota_lote_update_nota
  AFTER INSERT OR UPDATE OR DELETE ON public.nota_lote
  FOR EACH ROW EXECUTE FUNCTION public.fat_recalcular_nota_do_vinculo();

-- ─── Gatilho: o lote ganhou ou trocou o aplis_id ─────────────────────────────
CREATE OR REPLACE FUNCTION public.fat_recalcular_notas_do_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nota UUID;
BEGIN
  FOR v_nota IN SELECT id_nota FROM nota_lote WHERE id_lote = NEW.id_lote LOOP
    PERFORM fat_recalcular_nota(v_nota);
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_lote_aplis_id_update_nota ON public.lotes;
CREATE TRIGGER trigger_lote_aplis_id_update_nota
  AFTER UPDATE OF aplis_id ON public.lotes
  FOR EACH ROW
  WHEN (NEW.aplis_id IS DISTINCT FROM OLD.aplis_id)
  EXECUTE FUNCTION public.fat_recalcular_notas_do_lote();

-- ─── Saldo derivado ──────────────────────────────────────────────────────────
ALTER TABLE public.notas DROP COLUMN IF EXISTS valor_saldo;
ALTER TABLE public.notas DROP COLUMN IF EXISTS valor_glosado_definitivo;
ALTER TABLE public.notas ADD COLUMN valor_saldo DECIMAL(15, 2)
  GENERATED ALWAYS AS (
    COALESCE(valor_total, 0) - COALESCE(valor_recebido, 0) - COALESCE(valor_glosa_acatada, 0)
  ) STORED;

COMMENT ON COLUMN public.notas.valor_saldo IS
  'valor_total - valor_recebido - valor_glosa_acatada. Derivada; é o que ainda pode entrar. STORED porque não existe coluna gerada VIRTUAL antes do Postgres 18.';

-- ─── Carga ───────────────────────────────────────────────────────────────────
-- Só os títulos em que a troca muda algo: os que têm glosa acatada na foto e
-- os que tinham glosa definitiva (o status e o saldo deles dependiam dela).
-- Os demais ficam como estão, sem mexer em updated_at.
DO $$
DECLARE
  v_nota UUID;
BEGIN
  FOR v_nota IN
    SELECT DISTINCT nl.id_nota
      FROM glosa_recurso_requisicoes r
      JOIN lotes l ON l.aplis_id = r.id_lote_faturamento::TEXT
      JOIN nota_lote nl ON nl.id_lote = l.id_lote
     WHERE r.status_aplis IN (18, 8)
    UNION
    SELECT DISTINCT nota_id FROM glosas WHERE status = 'definitiva' AND nota_id IS NOT NULL
  LOOP
    PERFORM fat_recalcular_nota(v_nota);
  END LOOP;
END $$;
