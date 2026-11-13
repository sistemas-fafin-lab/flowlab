-- ═══════════════════════════════════════════════════════════════════════════════
-- Verificação: rejeitar a sugestão de um chamado do LAB-BRAIN cancela o chamado
-- Migration verificada: 20261113160000_eva_rejeitar_promover_card.sql
-- (.scratch/lab-brain-aprovacao-eva/issues/02-rejeitar-cancela-o-chamado.md)
--
-- Roda no banco de teste, numa transação que termina em ROLLBACK (docs/guides/BANCO_DE_TESTE.md):
--
--   SENHA=$(grep -E '^SUPABASE_TEST_SENHA=' .env | cut -d= -f2-)
--   PGPASSWORD="$SENHA" psql "host=aws-1-us-east-2.pooler.supabase.com port=5432 dbname=postgres \
--     user=postgres.eqzqkztgzcngnxmihdom sslmode=require" -v ON_ERROR_STOP=1 \
--     -f supabase/scripts/verificar_eva_rejeitar_promover_card.sql
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
  VALUES ('Verificação rejeitar promover_card', 'Chamado criado pelo script de verificação.', 'suporte', 'high',
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

-- ── 1. Rejeitar sem motivo é recusado (servidor e tela) ──────────────────────
DO $$
DECLARE
  c record;
  recusada boolean;
  v_motivo text;
BEGIN
  c := pg_temp.chamado_com_sugestao('verificacao-rejeitar-1');
  FOREACH v_motivo IN ARRAY ARRAY['', '   '] LOOP
    recusada := false;
    BEGIN
      PERFORM public.ti_agente_rejeitar_sugestao_como(c.sugestao, v_motivo, (SELECT aprovador FROM _v));
    EXCEPTION WHEN invalid_parameter_value THEN recusada := true;
    END;
    ASSERT recusada, format('motivo %L é recusado', v_motivo);
  END LOOP;

  recusada := false;
  BEGIN
    PERFORM public.ti_agente_rejeitar_sugestao_como(c.sugestao, NULL, (SELECT aprovador FROM _v));
  EXCEPTION WHEN invalid_parameter_value THEN recusada := true;
  END;
  ASSERT recusada, 'motivo nulo é recusado';

  recusada := false;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT aprovador FROM _v))::text, true);
  BEGIN
    PERFORM public.ti_agente_rejeitar_sugestao(c.sugestao, '');
  EXCEPTION WHEN invalid_parameter_value THEN recusada := true;
  END;
  PERFORM set_config('request.jwt.claims', '', true);
  ASSERT recusada, 'ti_agente_rejeitar_sugestao (tela) recusa motivo vazio';

  ASSERT (SELECT status FROM public.it_requests WHERE id = c.chamado) = 'pending', 'o chamado continua pendente';
  ASSERT (SELECT status FROM public.ti_agente_sugestoes WHERE id = c.sugestao) = 'pendente', 'a sugestão continua pendente';
  RAISE NOTICE 'ok: rejeitar sem motivo é recusado';
END $$;

-- ── 2. Rejeitar com motivo cancela o chamado e grava a resolução (servidor) ──
DO $$
DECLARE
  c record;
  r public.it_requests%ROWTYPE;
  s public.ti_agente_sugestoes%ROWTYPE;
  v_aprovador uuid := (SELECT aprovador FROM _v);
BEGIN
  c := pg_temp.chamado_com_sugestao('verificacao-rejeitar-2');
  PERFORM public.ti_agente_rejeitar_sugestao_como(c.sugestao, '  Esse acesso é liberado pelo RH.  ', v_aprovador);
  SELECT * INTO r FROM public.it_requests WHERE id = c.chamado;
  SELECT * INTO s FROM public.ti_agente_sugestoes WHERE id = c.sugestao;
  ASSERT r.status = 'cancelled', format('o chamado é cancelado (veio %s)', r.status);
  ASSERT r.resolution = 'Esse acesso é liberado pelo RH.', format('o motivo vira a resolução (veio %L)', r.resolution);
  ASSERT r.kanban_hidden, 'o chamado cancelado continua fora do Kanban';
  ASSERT s.status = 'rejeitada' AND s.motivo_rejeicao = 'Esse acesso é liberado pelo RH.'
     AND s.decidido_por = v_aprovador, 'a sugestão fica rejeitada com o motivo';
  ASSERT EXISTS (SELECT 1 FROM public.it_task_comments
                  WHERE task_id = c.chamado AND kind = 'resolution' AND user_id = v_aprovador
                    AND content = 'Esse acesso é liberado pelo RH.'),
    'o motivo entra na conversa do chamado como resolução';
  RAISE NOTICE 'ok: rejeitar com motivo cancela o chamado e grava a resolução';
END $$;

-- ── 3. O mesmo pelo caminho da tela ──────────────────────────────────────────
DO $$
DECLARE
  c record;
  r public.it_requests%ROWTYPE;
BEGIN
  c := pg_temp.chamado_com_sugestao('verificacao-rejeitar-3');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT aprovador FROM _v))::text, true);
  PERFORM public.ti_agente_rejeitar_sugestao(c.sugestao, 'Pedido duplicado do IT-120.');
  PERFORM set_config('request.jwt.claims', '', true);
  SELECT * INTO r FROM public.it_requests WHERE id = c.chamado;
  ASSERT r.status = 'cancelled' AND r.resolution = 'Pedido duplicado do IT-120.',
    format('a tela também cancela com o motivo (veio %s / %L)', r.status, r.resolution);
  RAISE NOTICE 'ok: rejeitar pela tela cancela o chamado e grava a resolução';
END $$;

-- ── 4. Quem não pode aprovar é barrado (servidor e tela) ─────────────────────
DO $$
DECLARE
  c record;
  barrado boolean;
BEGIN
  c := pg_temp.chamado_com_sugestao('verificacao-rejeitar-4');

  barrado := false;
  BEGIN
    PERFORM public.ti_agente_rejeitar_sugestao_como(c.sugestao, 'Não é do TI.', (SELECT sem_permissao FROM _v));
  EXCEPTION WHEN insufficient_privilege THEN barrado := true;
  END;
  ASSERT barrado, 'ti_agente_rejeitar_sugestao_como recusa quem não pode aprovar';

  barrado := false;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT sem_permissao FROM _v))::text, true);
  BEGIN
    PERFORM public.ti_agente_rejeitar_sugestao(c.sugestao, 'Não é do TI.');
  EXCEPTION WHEN insufficient_privilege THEN barrado := true;
  END;
  PERFORM set_config('request.jwt.claims', '', true);
  ASSERT barrado, 'ti_agente_rejeitar_sugestao (tela) recusa quem não pode aprovar';

  ASSERT (SELECT status FROM public.it_requests WHERE id = c.chamado) = 'pending', 'o chamado continua pendente';
  ASSERT (SELECT resolution FROM public.it_requests WHERE id = c.chamado) IS NULL, 'sem resolução';
  ASSERT (SELECT status FROM public.ti_agente_sugestoes WHERE id = c.sugestao) = 'pendente', 'a sugestão continua pendente';
  RAISE NOTICE 'ok: quem não pode aprovar é barrado na rejeição';
END $$;

-- ── 5. Chamado que já está no Kanban não é cancelado pela rejeição ───────────
DO $$
DECLARE
  c record;
  recusada boolean := false;
BEGIN
  c := pg_temp.chamado_com_sugestao('verificacao-rejeitar-5');
  UPDATE public.it_requests SET kanban_hidden = false, kanban_status = 'todo' WHERE id = c.chamado;
  BEGIN
    PERFORM public.ti_agente_rejeitar_sugestao_como(c.sugestao, 'Não é do TI.', (SELECT aprovador FROM _v));
  EXCEPTION WHEN invalid_parameter_value THEN recusada := true;
  END;
  ASSERT recusada, 'rejeitar a sugestão de um chamado já no Kanban é recusado';
  ASSERT (SELECT status FROM public.it_requests WHERE id = c.chamado) = 'pending', 'o chamado do Kanban não é cancelado';
  RAISE NOTICE 'ok: chamado que já está no Kanban não é cancelado pela rejeição';
END $$;

-- ── 6. Chamado já resolvido ou cancelado: a sugestão é rejeitada e ele fica como está ──
DO $$
DECLARE
  c record;
  r public.it_requests%ROWTYPE;
BEGIN
  c := pg_temp.chamado_com_sugestao('verificacao-rejeitar-6');
  UPDATE public.it_requests SET status = 'resolved', resolution = 'Resolvido pela tela.' WHERE id = c.chamado;
  PERFORM public.ti_agente_rejeitar_sugestao_como(c.sugestao, 'Não é do TI.', (SELECT aprovador FROM _v));
  SELECT * INTO r FROM public.it_requests WHERE id = c.chamado;
  ASSERT r.status = 'resolved' AND r.resolution = 'Resolvido pela tela.', 'o chamado resolvido fica como está';
  ASSERT (SELECT status FROM public.ti_agente_sugestoes WHERE id = c.sugestao) = 'rejeitada', 'a sugestão é rejeitada';
  RAISE NOTICE 'ok: chamado já resolvido fica como está';
END $$;

-- ── 7. Rejeitar outros tipos de sugestão continua igual ──────────────────────
DO $$
DECLARE
  c record;
  v_sug uuid;
BEGIN
  c := pg_temp.chamado_com_sugestao('verificacao-rejeitar-7');
  INSERT INTO public.ti_agente_sugestoes (origem, tipo, card_id, proposta, trecho)
  VALUES ('reuniao', 'comentar_card', c.chamado, jsonb_build_object('comentario', 'Algo.'), 'Trecho.')
  RETURNING id INTO v_sug;
  PERFORM public.ti_agente_rejeitar_sugestao_como(v_sug, 'Não se aplica.', (SELECT aprovador FROM _v));
  ASSERT (SELECT status FROM public.ti_agente_sugestoes WHERE id = v_sug) = 'rejeitada', 'a sugestão é rejeitada';
  ASSERT (SELECT status FROM public.it_requests WHERE id = c.chamado) = 'pending', 'o chamado não é cancelado';
  ASSERT (SELECT resolution FROM public.it_requests WHERE id = c.chamado) IS NULL, 'o chamado fica sem resolução';
  RAISE NOTICE 'ok: rejeitar outro tipo de sugestão não mexe no chamado';
END $$;

ROLLBACK;
