-- ═══════════════════════════════════════════════════════════════════════════════
-- EVA, o agente de TI — RPCs de aprovação, proposta e contagem
-- Migration: 20261013151000_eva_rpcs.sql
-- (.scratch/agente-ti/issues/11-fila-aprovacao-rpcs.md; contagem: issue 14)
--
-- A EVA executa ações, sempre com aprovação prévia (D6, D28):
--   ti_agente_aprovar_sugestao  — gestor aprova; aplica a mudança em it_requests
--   ti_agente_rejeitar_sugestao — gestor rejeita com motivo
--   ti_agente_propor_sugestao   — caminho dos comentários e do chat: grava a proposta
--                                 e, se o gestor confirmou (p_aprovar), já aprova e
--                                 executa na mesma transação (RN18)
--   ti_agente_cobrancas_hoje    — só a contagem de cobranças enviadas hoje (D24)
--
-- SECURITY DEFINER: as funções IGNORAM a RLS de it_requests (que só libera admin ou
-- department = 'TI'). A conferência de permissão na primeira linha é a barreira, e
-- só os campos listados mudam.
--
-- Prazo: gravado como meia-noite UTC do dia proposto, a mesma convenção do
-- ITTaskDrawer (o Board lê o dia com split('T')[0]) — RN02.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.ti_agente_sugestoes') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.ti_agente_sugestoes não existe. Aplique 20261013150000_eva_tabelas.sql antes desta migration.';
  END IF;
END $$;

BEGIN;

-- Dia 'YYYY-MM-DD' → meia-noite UTC daquele dia (convenção do ITTaskDrawer).
CREATE OR REPLACE FUNCTION public.ti_agente_prazo_para_due_date(p_dia text)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p_dia IS NULL OR btrim(p_dia) = '' THEN NULL
              ELSE (p_dia::date)::timestamp AT TIME ZONE 'UTC' END;
$$;

COMMENT ON FUNCTION public.ti_agente_prazo_para_due_date(text) IS 'Converte o dia proposto pela EVA (YYYY-MM-DD) para it_requests.due_date na convenção do Board: meia-noite UTC do dia.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. APROVAR
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ti_agente_aprovar_sugestao(p_id uuid, p_proposta jsonb DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sug         public.ti_agente_sugestoes%ROWTYPE;
  v_p           jsonb;
  v_card_id     uuid;
  v_codigo      text;
  v_titulo      text;
  v_resp        uuid[];
  v_coluna      text;
  v_aprovador   uuid := auth.uid();
  v_titulo_aviso text;
BEGIN
  IF NOT public.current_user_has_permission('canApproveAgenteTI') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar sugestões da EVA.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sug FROM public.ti_agente_sugestoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sugestão não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v_sug.status <> 'pendente' THEN
    RAISE EXCEPTION 'Esta sugestão já está "%".', v_sug.status USING ERRCODE = '22023';
  END IF;

  v_p := COALESCE(p_proposta, v_sug.proposta);

  IF v_sug.tipo = 'criar_card' THEN
    v_titulo := btrim(COALESCE(v_p->>'titulo', ''));
    IF v_titulo = '' THEN
      RAISE EXCEPTION 'A sugestão precisa de um título para virar card.' USING ERRCODE = '22023';
    END IF;
    v_coluna := COALESCE(NULLIF(v_p->>'kanban_status', ''), 'todo');

    INSERT INTO public.it_requests (
      title, description, request_type, priority, status, kanban_status,
      requested_by, assigned_to, due_date, project_id, sprint_id, is_internal, tags
    ) VALUES (
      v_titulo,
      NULLIF(btrim(COALESCE(v_p->>'descricao', '')), ''),
      'desenvolvimento',
      COALESCE(NULLIF(v_p->>'prioridade', ''), 'medium'),
      CASE WHEN v_coluna = 'done' THEN 'resolved' ELSE 'pending' END,
      v_coluna,
      v_aprovador,
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_p->'responsaveis', '[]'::jsonb))::uuid), '{}'),
      public.ti_agente_prazo_para_due_date(v_p->>'prazo'),
      NULLIF(v_p->>'projeto_id', '')::uuid,
      NULLIF(v_p->>'sprint_id', '')::uuid,
      true,
      ARRAY['agente-ti']
    )
    RETURNING id, codigo, assigned_to INTO v_card_id, v_codigo, v_resp;
    v_titulo_aviso := 'Card novo da EVA';

  ELSIF v_sug.tipo = 'atualizar_card' THEN
    IF v_sug.card_id IS NULL THEN
      RAISE EXCEPTION 'O card desta sugestão não existe mais.' USING ERRCODE = 'P0002';
    END IF;
    UPDATE public.it_requests r SET
      kanban_status = COALESCE(NULLIF(v_p->>'kanban_status', ''), r.kanban_status),
      status = CASE
        WHEN COALESCE(NULLIF(v_p->>'kanban_status', ''), r.kanban_status) = 'done' THEN 'resolved'
        WHEN NULLIF(v_p->>'kanban_status', '') IS NOT NULL AND r.status = 'resolved' THEN 'in_progress'
        ELSE r.status END,
      due_date = CASE WHEN v_p ? 'prazo' THEN public.ti_agente_prazo_para_due_date(v_p->>'prazo') ELSE r.due_date END,
      assigned_to = CASE WHEN jsonb_typeof(v_p->'responsaveis') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(v_p->'responsaveis')::uuid) ELSE r.assigned_to END,
      priority = COALESCE(NULLIF(v_p->>'prioridade', ''), r.priority)
    WHERE r.id = v_sug.card_id
    RETURNING r.id, r.codigo, r.title, r.assigned_to INTO v_card_id, v_codigo, v_titulo, v_resp;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'O card desta sugestão não existe mais.' USING ERRCODE = 'P0002';
    END IF;
    -- Observação junto da mudança vira comentário no card.
    IF NULLIF(btrim(COALESCE(v_p->>'comentario', '')), '') IS NOT NULL THEN
      INSERT INTO public.it_task_comments (task_id, user_id, content)
      VALUES (v_card_id, v_aprovador, 'EVA: ' || btrim(v_p->>'comentario'));
    END IF;
    v_titulo_aviso := 'Card atualizado pela EVA';

  ELSE -- comentar_card
    IF v_sug.card_id IS NULL THEN
      RAISE EXCEPTION 'O card desta sugestão não existe mais.' USING ERRCODE = 'P0002';
    END IF;
    IF NULLIF(btrim(COALESCE(v_p->>'comentario', '')), '') IS NULL THEN
      RAISE EXCEPTION 'A sugestão de comentário está vazia.' USING ERRCODE = '22023';
    END IF;
    SELECT id, codigo, title, assigned_to INTO v_card_id, v_codigo, v_titulo, v_resp
      FROM public.it_requests WHERE id = v_sug.card_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'O card desta sugestão não existe mais.' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO public.it_task_comments (task_id, user_id, content)
    VALUES (v_card_id, v_aprovador, 'EVA: ' || btrim(v_p->>'comentario'));
    v_titulo_aviso := 'Comentário da EVA';
  END IF;

  UPDATE public.ti_agente_sugestoes
     SET status = 'aprovada',
         proposta = v_p,
         decidido_por = v_aprovador,
         decidido_em = now(),
         card_resultante_id = v_card_id
   WHERE id = p_id;

  -- Aviso no sino para os responsáveis do card (menos quem aprovou).
  INSERT INTO public.user_notifications (user_id, title, content, module, type, link)
  SELECT DISTINCT u, v_titulo_aviso, v_codigo || ' · ' || COALESCE(v_titulo, ''), 'IT', 'info', '/it/kanban'
    FROM unnest(COALESCE(v_resp, '{}')) AS u
   WHERE u IS DISTINCT FROM v_aprovador
     AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = u);

  RETURN v_card_id;
END;
$$;

COMMENT ON FUNCTION public.ti_agente_aprovar_sugestao(uuid, jsonb) IS 'Aprova uma sugestão pendente da EVA e aplica a mudança em it_requests (criar, atualizar ou comentar). p_proposta substitui a proposta quando o gestor editou. Exige canApproveAgenteTI. Devolve o id do card.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. REJEITAR
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ti_agente_rejeitar_sugestao(p_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_has_permission('canApproveAgenteTI') THEN
    RAISE EXCEPTION 'Sem permissão para rejeitar sugestões da EVA.' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(COALESCE(p_motivo, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da rejeição.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ti_agente_sugestoes
     SET status = 'rejeitada', decidido_por = auth.uid(), decidido_em = now(), motivo_rejeicao = btrim(p_motivo)
   WHERE id = p_id AND status = 'pendente';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sugestão não encontrada ou já decidida.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.ti_agente_rejeitar_sugestao(uuid, text) IS 'Rejeita uma sugestão pendente da EVA, com motivo obrigatório. Exige canApproveAgenteTI.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. PROPOR (comentários e chat) — com aprovação na mesma transação para gestor
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ti_agente_propor_sugestao(
  p_tipo text,
  p_card_id uuid,
  p_proposta jsonb,
  p_trecho text,
  p_origem text,
  p_aprovar boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT (public.current_user_has_permission('canManageIT') OR public.current_user_has_permission('canApproveAgenteTI')) THEN
    RAISE EXCEPTION 'Sem permissão para propor ações da EVA.' USING ERRCODE = '42501';
  END IF;
  IF p_aprovar AND NOT public.current_user_has_permission('canApproveAgenteTI') THEN
    RAISE EXCEPTION 'Só gestores aprovam e executam ações da EVA.' USING ERRCODE = '42501';
  END IF;
  -- Reunião e WhatsApp nascem no servidor (service role); por aqui só comentário e chat.
  IF p_origem NOT IN ('comentario', 'chat') THEN
    RAISE EXCEPTION 'Origem inválida para proposta: %.', p_origem USING ERRCODE = '22023';
  END IF;
  IF p_tipo NOT IN ('criar_card', 'atualizar_card', 'comentar_card') THEN
    RAISE EXCEPTION 'Tipo de proposta inválido: %.', p_tipo USING ERRCODE = '22023';
  END IF;
  IF p_tipo <> 'criar_card' AND NOT EXISTS (SELECT 1 FROM public.it_requests WHERE id = p_card_id) THEN
    RAISE EXCEPTION 'O card da proposta não existe.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.ti_agente_sugestoes (origem, proposta_por, tipo, card_id, proposta, trecho, confianca)
  VALUES (p_origem, auth.uid(), p_tipo, CASE WHEN p_tipo = 'criar_card' THEN NULL ELSE p_card_id END,
          COALESCE(p_proposta, '{}'::jsonb), COALESCE(NULLIF(btrim(p_trecho), ''), 'Proposta da EVA'), 'alta')
  RETURNING id INTO v_id;

  IF p_aprovar THEN
    PERFORM public.ti_agente_aprovar_sugestao(v_id, NULL);
  END IF;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.ti_agente_propor_sugestao(text, uuid, jsonb, text, text, boolean) IS 'Grava uma ação proposta pela EVA (comentário ou chat). Com p_aprovar = true e canApproveAgenteTI, aprova e executa na mesma transação (D28). Devolve o id da sugestão.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. CONTAGEM DE COBRANÇAS DE HOJE (D24)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ti_agente_cobrancas_hoje()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.current_user_has_permission('canManageIT') OR public.current_user_has_permission('canApproveAgenteTI')) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT count(*)::integer
      FROM public.ti_agente_mensagens
     WHERE direcao = 'saida'
       AND tipo IN ('cobranca', 'cobranca_manual')
       AND status IN ('enviada', 'entregue', 'lida')
       AND (enviada_em AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );
END;
$$;

COMMENT ON FUNCTION public.ti_agente_cobrancas_hoje() IS 'Quantas cobranças a EVA enviou hoje (dia de Brasília). Só a contagem: o texto e os destinatários são de gestores (D24).';

REVOKE ALL ON FUNCTION public.ti_agente_aprovar_sugestao(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ti_agente_rejeitar_sugestao(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ti_agente_propor_sugestao(text, uuid, jsonb, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ti_agente_cobrancas_hoje() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ti_agente_aprovar_sugestao(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ti_agente_rejeitar_sugestao(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ti_agente_propor_sugestao(text, uuid, jsonb, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ti_agente_cobrancas_hoje() TO authenticated;

COMMIT;
