-- ═══════════════════════════════════════════════════════════════════════════════
-- Verificação: sugestão de promoção dos chamados do LAB-BRAIN (promover_card)
-- Migration verificada: 20261113150000_eva_promover_card_lab_brain.sql
-- (.scratch/lab-brain-aprovacao-eva/issues/01-sugestao-de-promocao-e-aprovacao.md)
--
-- Roda no banco de teste, numa transação que termina em ROLLBACK (docs/guides/BANCO_DE_TESTE.md):
--
--   SENHA=$(grep -E '^SUPABASE_TEST_SENHA=' .env | cut -d= -f2-)
--   PGPASSWORD="$SENHA" psql "host=aws-1-us-east-2.pooler.supabase.com port=5432 dbname=postgres \
--     user=postgres.eqzqkztgzcngnxmihdom sslmode=require" -v ON_ERROR_STOP=1 \
--     -f supabase/scripts/verificar_eva_promover_card.sql
--
-- Cada verificação imprime "ok: …"; a primeira que falhar para o script com o motivo.
-- Nada fica gravado. Só os números de chamado (sequência it_request_seq) avançam, como em
-- qualquer insert desfeito.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Quem aprova e quem não pode aprovar nem é gestor da EVA, entre as pessoas ativas do banco.
CREATE TEMP TABLE _v ON COMMIT DROP AS
SELECT
  (SELECT id FROM public.user_profiles
    WHERE deleted_at IS NULL AND disabled_at IS NULL
      AND public.ti_agente_tem_permissao(id, 'canApproveAgenteTI')
    ORDER BY id LIMIT 1) AS aprovador,
  (SELECT id FROM public.user_profiles
    WHERE deleted_at IS NULL AND disabled_at IS NULL
      AND NOT public.ti_agente_tem_permissao(id, 'canApproveAgenteTI')
      AND NOT public.ti_agente_tem_permissao(id, 'canManageAgenteTI')
    ORDER BY id LIMIT 1) AS sem_permissao;

DO $$
BEGIN
  IF (SELECT aprovador FROM _v) IS NULL OR (SELECT sem_permissao FROM _v) IS NULL THEN
    RAISE EXCEPTION 'O banco precisa de uma pessoa ativa que aprova sugestões da EVA e de outra que não.';
  END IF;
END $$;

-- Cria um chamado do LAB-BRAIN fora do Kanban e a sugestão da regra fixa ligada a ele.
CREATE FUNCTION pg_temp.chamado_com_sugestao(p_id_externo text, OUT chamado uuid, OUT sugestao uuid)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.it_requests (title, description, request_type, priority, requested_by, kanban_hidden, origem, id_externo)
  VALUES ('Verificação promover_card', 'Chamado criado pelo script de verificação.', 'suporte', 'high',
          (SELECT aprovador FROM _v), true, 'lab-brain', p_id_externo)
  RETURNING id INTO chamado;
  INSERT INTO public.ti_agente_sugestoes (origem, tipo, card_id, proposta, trecho, confianca)
  VALUES ('lab-brain', 'promover_card', chamado,
          jsonb_build_object('kanban_status', 'todo', 'prioridade', 'high', 'responsaveis', '[]'::jsonb,
                             'prazo', NULL, 'justificativa', 'Regra fixa.', 'sem_analise', true),
          'Regra fixa.', 'baixa')
  RETURNING id INTO sugestao;
END;
$$;

-- ── 1. Aprovar com a proposta original promove o chamado ─────────────────────
DO $$
DECLARE
  c record;
  r public.it_requests%ROWTYPE;
  s public.ti_agente_sugestoes%ROWTYPE;
  v_ret uuid;
BEGIN
  c := pg_temp.chamado_com_sugestao('verificacao-1');
  v_ret := public.ti_agente_aprovar_sugestao_como(c.sugestao, NULL, (SELECT aprovador FROM _v));
  SELECT * INTO r FROM public.it_requests WHERE id = c.chamado;
  SELECT * INTO s FROM public.ti_agente_sugestoes WHERE id = c.sugestao;
  ASSERT v_ret = c.chamado, 'a RPC devolve o id do chamado';
  ASSERT NOT r.kanban_hidden, 'o chamado sai de "fora do Kanban"';
  ASSERT r.kanban_status = 'todo', format('coluna A Fazer (veio %s)', r.kanban_status);
  ASSERT r.priority = 'high', 'prioridade da proposta';
  ASSERT r.status = 'pending', format('situação continua pendente (veio %s)', r.status);
  ASSERT r.assigned_to = '{}'::uuid[], 'sem responsável';
  ASSERT r.due_date IS NULL, 'sem prazo';
  ASSERT s.status = 'aprovada' AND s.card_resultante_id = c.chamado
     AND s.decidido_por = (SELECT aprovador FROM _v), 'a sugestão fica aprovada, ligada ao chamado';
  RAISE NOTICE 'ok: aprovar promove o chamado com a proposta';
END $$;

-- ── 2. Aprovar com a proposta editada aplica a editada ───────────────────────
DO $$
DECLARE
  c record;
  r public.it_requests%ROWTYPE;
  s public.ti_agente_sugestoes%ROWTYPE;
  v_resp uuid := (SELECT aprovador FROM _v);
BEGIN
  c := pg_temp.chamado_com_sugestao('verificacao-2');
  PERFORM public.ti_agente_aprovar_sugestao_como(
    c.sugestao,
    jsonb_build_object('kanban_status', 'in_progress', 'prioridade', 'critical',
                       'responsaveis', jsonb_build_array(v_resp), 'prazo', '2026-12-04',
                       'justificativa', 'Ajustada por quem aprova.'),
    v_resp);
  SELECT * INTO r FROM public.it_requests WHERE id = c.chamado;
  SELECT * INTO s FROM public.ti_agente_sugestoes WHERE id = c.sugestao;
  ASSERT NOT r.kanban_hidden, 'o chamado sai de "fora do Kanban"';
  ASSERT r.kanban_status = 'in_progress', format('coluna editada (veio %s)', r.kanban_status);
  ASSERT r.priority = 'critical', 'prioridade editada';
  ASSERT r.assigned_to = ARRAY[v_resp], 'responsáveis editados';
  ASSERT r.due_date = public.ti_agente_prazo_para_due_date('2026-12-04'),
    format('prazo editado (veio %s)', r.due_date);
  ASSERT r.status = 'pending', format('fora de Concluído a situação não muda (veio %s)', r.status);
  ASSERT s.proposta->>'kanban_status' = 'in_progress', 'a sugestão guarda a proposta aprovada';
  RAISE NOTICE 'ok: aprovar com a proposta editada aplica a editada';
END $$;

-- ── 3. Quem não pode aprovar é barrado (RPC do servidor e RPC da tela) ───────
DO $$
DECLARE
  c record;
  barrado boolean;
BEGIN
  c := pg_temp.chamado_com_sugestao('verificacao-3');

  barrado := false;
  BEGIN
    PERFORM public.ti_agente_aprovar_sugestao_como(c.sugestao, NULL, (SELECT sem_permissao FROM _v));
  EXCEPTION WHEN insufficient_privilege THEN barrado := true;
  END;
  ASSERT barrado, 'ti_agente_aprovar_sugestao_como recusa quem não pode aprovar';

  barrado := false;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT sem_permissao FROM _v))::text, true);
  BEGIN
    PERFORM public.ti_agente_aprovar_sugestao(c.sugestao, NULL);
  EXCEPTION WHEN insufficient_privilege THEN barrado := true;
  END;
  PERFORM set_config('request.jwt.claims', '', true);
  ASSERT barrado, 'ti_agente_aprovar_sugestao (tela) recusa quem não pode aprovar';

  ASSERT (SELECT kanban_hidden FROM public.it_requests WHERE id = c.chamado), 'o chamado continua fora do Kanban';
  ASSERT (SELECT status FROM public.ti_agente_sugestoes WHERE id = c.sugestao) = 'pendente', 'a sugestão continua pendente';
  RAISE NOTICE 'ok: quem não pode aprovar é barrado';
END $$;

-- ── 4. A segunda sugestão promover_card do mesmo chamado é recusada ──────────
DO $$
DECLARE
  c record;
  recusada boolean := false;
BEGIN
  c := pg_temp.chamado_com_sugestao('verificacao-4');
  BEGIN
    INSERT INTO public.ti_agente_sugestoes (origem, tipo, card_id, proposta, trecho)
    VALUES ('lab-brain', 'promover_card', c.chamado, '{}'::jsonb, 'Segunda.');
  EXCEPTION WHEN unique_violation THEN recusada := true;
  END;
  ASSERT recusada, 'o índice único parcial recusa a segunda sugestão promover_card';
  RAISE NOTICE 'ok: a segunda sugestão promover_card do mesmo chamado é recusada';
END $$;

-- ── 5. Chamado cancelado antes da decisão não entra no Kanban ────────────────
DO $$
DECLARE
  c record;
  recusada boolean := false;
BEGIN
  c := pg_temp.chamado_com_sugestao('verificacao-5');
  UPDATE public.it_requests SET status = 'cancelled' WHERE id = c.chamado;
  BEGIN
    PERFORM public.ti_agente_aprovar_sugestao_como(c.sugestao, NULL, (SELECT aprovador FROM _v));
  EXCEPTION WHEN invalid_parameter_value THEN recusada := true;
  END;
  ASSERT recusada, 'aprovar a sugestão de um chamado cancelado é recusado';
  ASSERT (SELECT kanban_hidden FROM public.it_requests WHERE id = c.chamado), 'o chamado cancelado continua fora do Kanban';
  RAISE NOTICE 'ok: chamado cancelado antes da decisão não entra no Kanban';
END $$;

ROLLBACK;
