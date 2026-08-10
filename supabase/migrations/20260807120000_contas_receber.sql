-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber — adaptação do schema legado de faturamento
-- Migration: 20260807120000_contas_receber.sql
--
-- O módulo de faturamento nasceu em 20260320_billing_module.sql desenhado para
-- ser espelhado por um worker de sync (workers/billing-sync/), que nunca saiu do
-- mock. As tabelas ficaram vazias e a tela /faturamento/recebimentos sempre
-- mostrou nada.
--
-- O modelo que passa a valer é outro: o operador agrupa manualmente lotes lidos
-- ao vivo do MySQL do apLIS num TÍTULO a receber, e registra sobre ele baixas
-- parciais e glosas. O schema legado encaixa quase inteiro nesse modelo:
--
--   notas       → o título a receber
--   nota_lote   → o agrupamento manual (1 título → N lotes)
--   lotes       → SNAPSHOT do fatlote no instante em que entrou no título
--   requisicoes → snapshot das guias, o que viabiliza rateio de baixa/glosa
--   recebimentos→ as baixas
--   glosas      → as glosas
--
-- Esta migration faz as adaptações pontuais: colunas do snapshot do apLIS,
-- colunas de sincronização da fase 2 (quando a baixa for replicada para o
-- apLIS), a reescrita da trigger de totais — que estava errada em quatro
-- pontos — e a troca da RLS `USING (true)` por permissões reais.
--
-- É AUTOSSUFICIENTE de propósito (IF NOT EXISTS / DROP … IF EXISTS em tudo):
-- há drift conhecido entre eqz (test) e jqx (prod) e a migration não pode
-- assumir em que estado encontra o banco.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 0. Pré-condições ─────────────────────────────────────────────────────────
-- Sem estas duas coisas a migration cria objetos que só quebram no primeiro uso
-- real — o pior momento para descobrir. Falha alto e claro aqui.
DO $$
BEGIN
  IF to_regclass('public.notas') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.notas não existe. Aplique 20260320_billing_module.sql antes desta migration.';
  END IF;
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. COLUNAS NOVAS
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1.1 lotes — snapshot do fatlote ──────────────────────────────────────────
-- valor_total e qtd_requisicoes já existem e passam a ser CONGELADOS no momento
-- em que o lote entra num título: o backup do apLIS continua se atualizando, e
-- um título não pode mudar de valor sozinho depois de emitido.
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS status_aplis        SMALLINT;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS protocolo           TEXT;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS nfe_numero          TEXT;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS numero_rps          INTEGER;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS data_vencimento_rps DATE;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS data_snapshot       TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN lotes.status_aplis IS 'Código STLOT do fatlote.Status no apLIS (1=Em Processamento … 8=Prejuízo). É a verdade sobre o estado do lote.';
COMMENT ON COLUMN lotes.data_snapshot IS 'Quando os valores foram copiados do apLIS. O lote não é re-sincronizado depois de entrar num título.';

-- O CHECK de `status` (aberto|enviado|processado|fechado) foi desenhado para um
-- ciclo de vida interno que não existe: o estado real vem do apLIS e tem oito
-- valores. `status` passa a guardar o rótulo STLOT legível e `status_aplis` o
-- código; o CHECK sai de cena em vez de virar uma segunda lista para manter.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.lotes'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.lotes DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- ─── 1.2 notas — o título a receber ───────────────────────────────────────────
ALTER TABLE notas ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Saldo é derivado, nunca digitado. STORED (e não uma view) porque o aging
-- filtra e ordena por ele em toda listagem de títulos abertos.
-- COALESCE porque valor_recebido/valor_glosado são NULLABLE com default 0: um
-- INSERT explícito com NULL faria o saldo inteiro virar NULL.
ALTER TABLE notas DROP COLUMN IF EXISTS valor_saldo;
ALTER TABLE notas ADD COLUMN valor_saldo DECIMAL(15, 2)
  GENERATED ALWAYS AS (
    COALESCE(valor_total, 0) - COALESCE(valor_recebido, 0) - COALESCE(valor_glosado, 0)
  ) STORED;

COMMENT ON COLUMN notas.valor_saldo IS 'valor_total - valor_recebido - valor_glosado. Derivada; é o que ainda se espera receber.';

-- 'liquidada' é o título fechado sem saldo a cobrar porque o que não foi pago
-- virou glosa definitiva. Sem esse estado ele ficaria eternamente
-- "parcialmente_recebida" e sujaria o aging para sempre.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.notas'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.notas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE notas ADD CONSTRAINT notas_status_check
  CHECK (status IN ('aberta', 'parcialmente_recebida', 'recebida', 'liquidada', 'glosada', 'cancelada'));

-- ─── 1.3 recebimentos — as baixas ─────────────────────────────────────────────
ALTER TABLE recebimentos ADD COLUMN IF NOT EXISTS forma_recebimento TEXT;
ALTER TABLE recebimentos ADD COLUMN IF NOT EXISTS registrado_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fase 2: a equipe do apLIS vai expor um endpoint de baixa de cobrança e o
-- FlowLab replicará cada baixa para lá. O schema já nasce com o rastro para
-- que a fase 2 seja só preencher estas colunas — nenhuma migration de dados.
ALTER TABLE recebimentos ADD COLUMN IF NOT EXISTS aplis_sync_status TEXT DEFAULT 'pendente';
ALTER TABLE recebimentos ADD COLUMN IF NOT EXISTS aplis_sync_at     TIMESTAMPTZ;
ALTER TABLE recebimentos ADD COLUMN IF NOT EXISTS aplis_sync_erro   TEXT;

ALTER TABLE recebimentos DROP CONSTRAINT IF EXISTS recebimentos_aplis_sync_status_check;
ALTER TABLE recebimentos ADD CONSTRAINT recebimentos_aplis_sync_status_check
  CHECK (aplis_sync_status IN ('pendente', 'enviado', 'erro', 'nao_aplicavel'));

COMMENT ON COLUMN recebimentos.aplis_sync_status IS 'Replicação da baixa para o apLIS (fase 2). Nasce pendente; nada consome ainda.';

-- ─── 1.4 glosas ───────────────────────────────────────────────────────────────
-- recebimento_id era NOT NULL, o que tornava impossível lançar a glosa que chega
-- no demonstrativo ANTES de qualquer pagamento — situação corriqueira.
ALTER TABLE glosas ALTER COLUMN recebimento_id DROP NOT NULL;
ALTER TABLE glosas ADD COLUMN IF NOT EXISTS lote_id UUID REFERENCES lotes(id_lote) ON DELETE SET NULL;

-- A FK para recebimentos era ON DELETE CASCADE, coerente com o NOT NULL de
-- antes. Agora ela destrói informação: estornar uma baixa lançada errada
-- apagaria junto a glosa que veio no demonstrativo da operadora — a glosa é um
-- fato dela, não um detalhe do nosso pagamento. Vira SET NULL.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.glosas'::regclass
       AND contype = 'f'
       AND confrelid = 'public.recebimentos'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.glosas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE glosas ADD CONSTRAINT glosas_recebimento_id_fkey
  FOREIGN KEY (recebimento_id) REFERENCES recebimentos(id_receb) ON DELETE SET NULL;

COMMENT ON COLUMN glosas.recebimento_id IS 'Baixa que revelou a glosa, quando houve. NULL = glosa lançada sem pagamento associado.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. TOTAIS DO TÍTULO
--
-- A update_nota_valores() original tinha quatro defeitos:
--   1. não tratava DELETE — estornar uma baixa deixava valor_recebido mentindo;
--   2. SUM sem COALESCE dentro do CASE — `NULL >= valor_total` é NULL, e só
--      funcionava por acidente da ordem dos ramos;
--   3. 'glosada' vinha depois de 'parcialmente_recebida' e nunca era alcançado
--      quando havia qualquer recebimento;
--   4. não fechava o título quando recebido + glosa definitiva = valor_total.
--
-- O recálculo vira uma função própria: a trigger precisa dela para os DOIS
-- títulos quando uma baixa é remanejada, e as RPCs da etapa 2 chamam a mesma
-- coisa depois de mexer em lote.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fat_recalcular_nota(p_nota_id UUID)
RETURNS void
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
  -- ser cobrável. 'definitiva' é contada à parte porque só ela fecha o título.
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
     SET valor_recebido = v_recebido,
         valor_glosado  = v_glosado,
         status         = v_status,
         updated_at     = NOW()
   WHERE id_nota = p_nota_id;
END;
$$;

COMMENT ON FUNCTION public.fat_recalcular_nota(UUID) IS 'Recalcula valor_recebido, valor_glosado e status de um título a partir de suas baixas e glosas.';

CREATE OR REPLACE FUNCTION public.update_nota_valores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Os dois lados: um UPDATE pode mover a baixa de um título para outro, e
  -- nesse caso os DOIS precisam ser recalculados. Quando nota_id não mudou, o
  -- segundo bloco não dispara e o recálculo acontece uma vez só.
  IF TG_OP <> 'INSERT' THEN
    PERFORM fat_recalcular_nota(OLD.nota_id);
  END IF;

  IF TG_OP <> 'DELETE'
     AND (TG_OP = 'INSERT' OR NEW.nota_id IS DISTINCT FROM OLD.nota_id) THEN
    PERFORM fat_recalcular_nota(NEW.nota_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_recebimento_update_nota ON recebimentos;
CREATE TRIGGER trigger_recebimento_update_nota
  AFTER INSERT OR UPDATE OR DELETE ON recebimentos
  FOR EACH ROW EXECUTE FUNCTION update_nota_valores();

DROP TRIGGER IF EXISTS trigger_glosa_update_nota ON glosas;
CREATE TRIGGER trigger_glosa_update_nota
  AFTER INSERT OR UPDATE OR DELETE ON glosas
  FOR EACH ROW EXECUTE FUNCTION update_nota_valores();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. RLS
--
-- As policies originais eram `USING (true)` para `authenticated` nas 8 tabelas:
-- qualquer usuário logado — inclusive um solicitante — lia e escrevia dados
-- financeiros. Passam a exigir permissão explícita.
--
-- Leitura aceita canViewBilling OU canManageBilling: quem pode registrar baixa
-- obviamente pode ver o título, e depender de marcar as duas caixas no cadastro
-- de perfis produziria um estado quebrado silencioso (a tela abriria vazia).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE operadoras       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisicoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE nota_lote        ENABLE ROW LEVEL SECURITY;
ALTER TABLE recebimentos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE glosas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_sync_log ENABLE ROW LEVEL SECURITY;

-- Derruba TODAS as policies existentes dessas tabelas antes de recriar. Por nome
-- seria frágil: eqz e jqx podem ter recebido ajustes manuais, e uma policy
-- permissiva esquecida anula todo o resto (policies são OR entre si).
DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['operadoras','lotes','requisicoes','notas','nota_lote','recebimentos','glosas','billing_sync_log']
  LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE
  t text;
  ver text := '(public.current_user_has_permission(''canViewBilling'') OR public.current_user_has_permission(''canManageBilling''))';
  gerir text := 'public.current_user_has_permission(''canManageBilling'')';
BEGIN
  FOREACH t IN ARRAY ARRAY['operadoras','lotes','requisicoes','notas','nota_lote','recebimentos','glosas']
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
                   t || '_select_billing', t, ver);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
                   t || '_insert_billing', t, gerir);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
                   t || '_update_billing', t, gerir, gerir);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)',
                   t || '_delete_billing', t, gerir);
  END LOOP;
END $$;

-- O log de sync é escrito por rota serverless com service_role, nunca pelo
-- cliente; para o operador ele é só leitura.
CREATE POLICY "billing_sync_log_select_billing" ON billing_sync_log
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewBilling')
      OR public.current_user_has_permission('canManageBilling'));

CREATE POLICY "billing_sync_log_service_role" ON billing_sync_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. ÍNDICES DOS DASHBOARDS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Aging: varre todos os títulos abertos por data_vencimento.
CREATE INDEX IF NOT EXISTS idx_notas_vencimento_status ON notas(data_vencimento, status);
-- Série mensal e recorte por operadora.
CREATE INDEX IF NOT EXISTS idx_notas_operadora_competencia ON notas(operadora_id, competencia);
-- KPI de recebido no período e prazo médio de recebimento.
CREATE INDEX IF NOT EXISTS idx_recebimentos_data_receb_valor ON recebimentos(data_receb);
-- Recálculo do título e listagem de glosas por título.
CREATE INDEX IF NOT EXISTS idx_glosas_nota_status ON glosas(nota_id, status);
CREATE INDEX IF NOT EXISTS idx_glosas_lote ON glosas(lote_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. DOCUMENTAÇÃO DO NOVO PAPEL DAS TABELAS
-- ═══════════════════════════════════════════════════════════════════════════════
COMMENT ON TABLE lotes IS 'Snapshot de um fatlote do apLIS no instante em que entrou num título. Não é re-sincronizado.';
COMMENT ON TABLE requisicoes IS 'Snapshot das guias de um lote. Base do rateio de baixa e glosa por guia.';
COMMENT ON TABLE notas IS 'Título a receber: agrupamento manual de lotes do apLIS cobrado de uma operadora.';
COMMENT ON TABLE nota_lote IS 'Agrupamento manual título ↔ lotes (1 título → N lotes).';
COMMENT ON TABLE recebimentos IS 'Baixas de um título (N por título, parciais).';
