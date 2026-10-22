-- Saldo do título passa a contar a glosa ainda não resolvida.
--
-- Antes: valor_saldo = total - recebido - valor_glosado, e valor_glosado soma
-- aberta + em_recurso + definitiva. Uma glosa recém-lançada (as do apLIS nascem
-- 'aberta') zerava o saldo: lote 5657 (nota 7988, FASCAL) com R$ 319,68 de glosa
-- total aparecia com saldo R$ 0,00 — como se não houvesse nada a cobrar.
--
-- Agora: valor_saldo = total - recebido - glosa DEFINITIVA. Aberta ou em recurso
-- ainda é dinheiro pendente (é o que a tela de baixa já dizia); só a definitiva,
-- em que o laboratório desistiu do valor, encerra o saldo. Com isso o saldo zera
-- exatamente quando o status vira 'recebida' ou 'liquidada'.
--
-- valor_glosado continua somando aberta + em_recurso + definitiva: é a coluna
-- "Glosado" da lista, o teto das RPCs de glosa e a base da prévia do apLIS (que
-- calcula a própria sobra a explicar a partir dele, não de valor_saldo).
--
-- Efeito no painel: total a receber, vencido e aging passam a incluir as glosas
-- abertas/em recurso (somam valor_saldo > 0).
--
-- Depende de 20260807120000_contas_receber.sql (fat_recalcular_nota, gatilhos).

ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS valor_glosado_definitivo DECIMAL(15, 2) DEFAULT 0;

COMMENT ON COLUMN public.notas.valor_glosado_definitivo IS
  'Soma das glosas definitivas do título. Mantida por fat_recalcular_nota; é a parte do glosado que sai do saldo.';

CREATE OR REPLACE FUNCTION public.fat_recalcular_nota(p_nota_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total      DECIMAL(15, 2);
  v_recebido   DECIMAL(15, 2);
  v_glosado    DECIMAL(15, 2);
  v_definitiva DECIMAL(15, 2);
  v_cancelada  BOOLEAN;
  v_status     TEXT;
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

  -- 'revertida' fica de fora do glosado: o recurso foi ganho e o valor voltou a
  -- ser cobrável. 'definitiva' é contada à parte porque só ela fecha o título e
  -- só ela sai do saldo.
  SELECT COALESCE(SUM(valor) FILTER (WHERE status IN ('aberta', 'em_recurso', 'definitiva')), 0),
         COALESCE(SUM(valor) FILTER (WHERE status = 'definitiva'), 0)
    INTO v_glosado, v_definitiva
    FROM glosas
   WHERE nota_id = p_nota_id;

  -- Precedência: cancelada (decisão manual, nada automático a desfaz) >
  -- recebida > liquidada > parcialmente_recebida > glosada > aberta.
  -- O `v_total > 0` impede que um título recém-criado sem valor (0 >= 0) já
  -- nasça anunciando "recebida".
  v_status := CASE
    WHEN v_cancelada                                          THEN 'cancelada'
    WHEN v_total > 0 AND v_recebido >= v_total                THEN 'recebida'
    WHEN v_total > 0 AND v_recebido + v_definitiva >= v_total THEN 'liquidada'
    WHEN v_recebido > 0                                       THEN 'parcialmente_recebida'
    WHEN v_definitiva > 0                                     THEN 'glosada'
    ELSE                                                           'aberta'
  END;

  UPDATE notas
     SET valor_recebido           = v_recebido,
         valor_glosado            = v_glosado,
         valor_glosado_definitivo = v_definitiva,
         status                   = v_status,
         updated_at               = NOW()
   WHERE id_nota = p_nota_id;
END;
$$;

COMMENT ON FUNCTION public.fat_recalcular_nota(UUID) IS 'Recalcula valor_recebido, valor_glosado, valor_glosado_definitivo e status de um título a partir de suas baixas e glosas.';

-- Backfill direto (sem passar por fat_recalcular_nota) para não mexer em status
-- nem em updated_at de todos os títulos — só a coluna nova.
UPDATE public.notas n
   SET valor_glosado_definitivo = g.definitiva
  FROM (
    SELECT nota_id, SUM(valor) AS definitiva
      FROM public.glosas
     WHERE status = 'definitiva'
     GROUP BY nota_id
  ) g
 WHERE g.nota_id = n.id_nota
   AND n.valor_glosado_definitivo IS DISTINCT FROM g.definitiva;

ALTER TABLE public.notas DROP COLUMN IF EXISTS valor_saldo;
ALTER TABLE public.notas ADD COLUMN valor_saldo DECIMAL(15, 2)
  GENERATED ALWAYS AS (
    COALESCE(valor_total, 0) - COALESCE(valor_recebido, 0) - COALESCE(valor_glosado_definitivo, 0)
  ) STORED;

COMMENT ON COLUMN public.notas.valor_saldo IS
  'valor_total - valor_recebido - valor_glosado_definitivo. Derivada; é o que ainda está pendente, inclusive o glosado em aberto ou em recurso. STORED porque não existe coluna gerada VIRTUAL antes do Postgres 18.';
