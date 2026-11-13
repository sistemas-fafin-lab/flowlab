-- ═══════════════════════════════════════════════════════════════════════════════
-- Verificação: promover o chamado do LAB-BRAIN por fora da fila substitui a sugestão
-- Migration verificada: 20261113170000_eva_promover_card_substituida.sql
-- (.scratch/lab-brain-aprovacao-eva/issues/03-promocao-manual-substitui-a-sugestao.md)
--
-- Roda no banco de teste, numa transação que termina em ROLLBACK (docs/guides/BANCO_DE_TESTE.md):
--
--   SENHA=$(grep -E '^SUPABASE_TEST_SENHA=' .env | cut -d= -f2-)
--   PGPASSWORD="$SENHA" psql "host=aws-1-us-east-2.pooler.supabase.com port=5432 dbname=postgres \
--     user=postgres.eqzqkztgzcngnxmihdom sslmode=require" -v ON_ERROR_STOP=1 \
--     -f supabase/scripts/verificar_eva_promover_card_substituida.sql
--
-- Cada verificação imprime "ok: …"; a primeira que falhar para o script com o motivo.
-- Nada fica gravado. Só os números de chamado (sequência it_request_seq) avançam, como em
-- qualquer insert desfeito.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Quem aprova sugestões da EVA, e alguém do TI (canManageIT) que de preferência não aprova:
-- a promoção pela tela roda com a RLS dessa pessoa.
CREATE TEMP TABLE _v ON COMMIT DROP AS
SELECT
  (SELECT id FROM public.user_profiles
    WHERE deleted_at IS NULL AND disabled_at IS NULL
      AND public.ti_agente_tem_permissao(id, 'canApproveAgenteTI')
    ORDER BY id LIMIT 1) AS aprovador,
  (SELECT id FROM public.user_profiles
    WHERE deleted_at IS NULL AND disabled_at IS NULL
      AND public.ti_agente_tem_permissao(id, 'canManageIT')
    ORDER BY public.ti_agente_tem_permissao(id, 'canApproveAgenteTI'), id LIMIT 1) AS ti;

DO $$
BEGIN
  IF (SELECT aprovador FROM _v) IS NULL OR (SELECT ti FROM _v) IS NULL THEN
    RAISE EXCEPTION 'O banco precisa de uma pessoa ativa que aprova sugestões da EVA e de uma do TI (canManageIT).';
  END IF;
END $$;

GRANT SELECT ON _v TO authenticated;

-- Cria um chamado do LAB-BRAIN fora do Kanban e a sugestão da regra fixa ligada a ele.
CREATE FUNCTION pg_temp.chamado_com_sugestao(p_id_externo text, OUT chamado uuid, OUT sugestao uuid)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.it_requests (title, description, request_type, priority, requested_by, kanban_hidden, origem, id_externo)
  VALUES ('Verificação substituir promover_card', 'Chamado criado pelo script de verificação.', 'suporte', 'high',
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

-- ── 1. Promover por fora (tela de Solicitações de TI) marca como substituída ──
-- O mesmo UPDATE do KanbanPromoteModal (handleSaveCard), com a RLS de quem é do TI.
CREATE TEMP TABLE _c1 ON COMMIT DROP AS SELECT * FROM pg_temp.chamado_com_sugestao('verificacao-substituir-1');
GRANT SELECT ON _c1 TO authenticated;

SELECT set_config('request.jwt.claims',
                  json_build_object('sub', (SELECT ti FROM _v), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
UPDATE public.it_requests SET kanban_hidden = false, kanban_status = 'todo'
 WHERE id = (SELECT chamado FROM _c1);
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

DO $$
DECLARE
  s public.ti_agente_sugestoes%ROWTYPE;
BEGIN
  ASSERT NOT (SELECT kanban_hidden FROM public.it_requests WHERE id = (SELECT chamado FROM _c1)),
    'a tela consegue tirar o chamado de fora do Kanban';
  SELECT * INTO s FROM public.ti_agente_sugestoes WHERE id = (SELECT sugestao FROM _c1);
  ASSERT s.status = 'substituida', format('a sugestão fica substituída (veio %s)', s.status);
  ASSERT s.decidido_por IS NULL AND s.decidido_em IS NULL, 'substituída não tem quem decidiu';
  RAISE NOTICE 'ok: promover pela tela marca a sugestão como substituída';
END $$;

-- ── 2. Promover por outro caminho (servidor) também marca ───────────────────
DO $$
DECLARE
  c record;
BEGIN
  c := pg_temp.chamado_com_sugestao('verificacao-substituir-2');
  UPDATE public.it_requests SET kanban_hidden = false WHERE id = c.chamado;
  ASSERT (SELECT status FROM public.ti_agente_sugestoes WHERE id = c.sugestao) = 'substituida',
    'promover por qualquer caminho substitui';
  RAISE NOTICE 'ok: promover por outro caminho marca a sugestão como substituída';
END $$;

-- ── 3. Mexer no chamado sem tirá-lo de fora do Kanban não muda a sugestão ───
DO $$
DECLARE
  c record;
BEGIN
  c := pg_temp.chamado_com_sugestao('verificacao-substituir-3');
  UPDATE public.it_requests SET priority = 'low', kanban_hidden = true WHERE id = c.chamado;
  ASSERT (SELECT status FROM public.ti_agente_sugestoes WHERE id = c.sugestao) = 'pendente',
    'editar o chamado fora do Kanban mantém a sugestão pendente';
  RAISE NOTICE 'ok: editar o chamado fora do Kanban não substitui';
END $$;

-- ── 4. Aprovar pela RPC não marca a própria sugestão ─────────────────────────
DO $$
DECLARE
  c record;
  s public.ti_agente_sugestoes%ROWTYPE;
  v_card uuid;
BEGIN
  c := pg_temp.chamado_com_sugestao('verificacao-substituir-4');
  v_card := public.ti_agente_aprovar_sugestao_como(c.sugestao, NULL, (SELECT aprovador FROM _v));
  SELECT * INTO s FROM public.ti_agente_sugestoes WHERE id = c.sugestao;
  ASSERT v_card = c.chamado, 'a RPC devolve o chamado promovido';
  ASSERT NOT (SELECT kanban_hidden FROM public.it_requests WHERE id = c.chamado), 'o chamado entra no Kanban';
  ASSERT s.status = 'aprovada', format('a sugestão fica aprovada (veio %s)', s.status);
  ASSERT COALESCE(current_setting('ti_agente.aprovando', true), '') = '',
    'a RPC desliga a exclusão depois de promover';
  RAISE NOTICE 'ok: aprovar pela RPC não marca a própria sugestão como substituída';
END $$;

-- ── 5. Depois de uma aprovação, promover outro chamado na mesma transação substitui ──
DO $$
DECLARE
  a record;
  b record;
BEGIN
  a := pg_temp.chamado_com_sugestao('verificacao-substituir-5a');
  b := pg_temp.chamado_com_sugestao('verificacao-substituir-5b');
  PERFORM public.ti_agente_aprovar_sugestao_como(a.sugestao, NULL, (SELECT aprovador FROM _v));
  UPDATE public.it_requests SET kanban_hidden = false WHERE id = b.chamado;
  ASSERT (SELECT status FROM public.ti_agente_sugestoes WHERE id = a.sugestao) = 'aprovada', 'a aprovada continua aprovada';
  ASSERT (SELECT status FROM public.ti_agente_sugestoes WHERE id = b.sugestao) = 'substituida', 'a outra fica substituída';
  RAISE NOTICE 'ok: a exclusão da aprovação vale só para a própria sugestão';
END $$;

-- ── 6. Sugestão já decidida não muda ─────────────────────────────────────────
DO $$
DECLARE
  c record;
BEGIN
  -- Rejeitada: o chamado é cancelado, e mesmo assim alguém o põe no Kanban por fora.
  c := pg_temp.chamado_com_sugestao('verificacao-substituir-6r');
  PERFORM public.ti_agente_rejeitar_sugestao_como(c.sugestao, 'Fora do escopo do TI.', (SELECT aprovador FROM _v));
  UPDATE public.it_requests SET kanban_hidden = false WHERE id = c.chamado;
  ASSERT (SELECT status FROM public.ti_agente_sugestoes WHERE id = c.sugestao) = 'rejeitada', 'a rejeitada continua rejeitada';

  -- Aprovada: o chamado volta para fora do Kanban e é promovido de novo por fora.
  c := pg_temp.chamado_com_sugestao('verificacao-substituir-6a');
  PERFORM public.ti_agente_aprovar_sugestao_como(c.sugestao, NULL, (SELECT aprovador FROM _v));
  UPDATE public.it_requests SET kanban_hidden = true WHERE id = c.chamado;
  UPDATE public.it_requests SET kanban_hidden = false WHERE id = c.chamado;
  ASSERT (SELECT status FROM public.ti_agente_sugestoes WHERE id = c.sugestao) = 'aprovada', 'a aprovada continua aprovada';
  RAISE NOTICE 'ok: sugestão já decidida não muda';
END $$;

-- ── 7. Outros tipos de sugestão do mesmo chamado não mudam ───────────────────
DO $$
DECLARE
  c record;
  v_outra uuid;
BEGIN
  c := pg_temp.chamado_com_sugestao('verificacao-substituir-7');
  INSERT INTO public.ti_agente_sugestoes (origem, tipo, card_id, proposta, trecho, confianca)
  VALUES ('chat', 'comentar_card', c.chamado, jsonb_build_object('comentario', 'Oi.'), 'Oi.', 'media')
  RETURNING id INTO v_outra;
  UPDATE public.it_requests SET kanban_hidden = false WHERE id = c.chamado;
  ASSERT (SELECT status FROM public.ti_agente_sugestoes WHERE id = v_outra) = 'pendente', 'comentar_card continua pendente';
  RAISE NOTICE 'ok: só a sugestão promover_card é substituída';
END $$;

ROLLBACK;
