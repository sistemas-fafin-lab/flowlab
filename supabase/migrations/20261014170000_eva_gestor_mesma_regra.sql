-- ═══════════════════════════════════════════════════════════════════════════════
-- EVA — quem é gestor, com a mesma regra das policies
-- Migration: 20261014170000_eva_gestor_mesma_regra.sql
-- (.scratch/agente-ti/issues/18-comandos-whatsapp.md; plano D29)
--
-- 20261014160000_eva_comandos_whatsapp.sql conferia o aprovador com user_has_permission. Essa
-- função tem um fallback de role legado que dá ao "operator" quase todas as chaves, inclusive
-- canApproveAgenteTI. As policies (current_user_has_permission), a tela e o servidor da EVA não
-- dão. O servidor confere antes de chamar, então não havia brecha, mas o banco precisa da mesma
-- regra: admin, ou cargo com canApproveAgenteTI; usuário removido ou desativado, nunca.
--
-- ti_agente_eh_gestor(uuid) é a regra de current_user_has_permission para um usuário dado. As duas
-- funções "como" passam a usá-la; o resto do corpo é o mesmo da migration anterior.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.ti_agente_aprovar_sugestao_como(uuid, jsonb, uuid)') IS NULL THEN
    RAISE EXCEPTION 'Aplique 20261014160000_eva_comandos_whatsapp.sql antes desta migration.';
  END IF;
END $$;

BEGIN;

CREATE OR REPLACE FUNCTION public.ti_agente_eh_gestor(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.user_profiles p
      LEFT JOIN public.custom_roles cr ON cr.id = p.custom_role_id
     WHERE p.id = p_user
       AND p.deleted_at IS NULL
       AND p.disabled_at IS NULL
       AND (p.role = 'admin' OR cr.permissions @> to_jsonb(ARRAY['canApproveAgenteTI']))
  );
$$;

COMMENT ON FUNCTION public.ti_agente_eh_gestor(uuid) IS 'Gestor da EVA: admin, ou cargo com canApproveAgenteTI; removido ou desativado, não. A mesma regra de current_user_has_permission, para um usuário dado (comandos pelo WhatsApp, D29).';

CREATE OR REPLACE FUNCTION public.ti_agente_aprovar_sugestao_como(p_id uuid, p_proposta jsonb, p_aprovador uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sug          public.ti_agente_sugestoes%ROWTYPE;
  v_p            jsonb;
  v_card_id      uuid;
  v_codigo       text;
  v_titulo       text;
  v_resp         uuid[];
  v_coluna       text;
  v_titulo_aviso text;
BEGIN
  IF NOT public.ti_agente_eh_gestor(p_aprovador) THEN
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
      p_aprovador,
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
    IF NULLIF(btrim(COALESCE(v_p->>'comentario', '')), '') IS NOT NULL THEN
      INSERT INTO public.it_task_comments (task_id, user_id, content)
      VALUES (v_card_id, p_aprovador, 'EVA: ' || btrim(v_p->>'comentario'));
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
    VALUES (v_card_id, p_aprovador, 'EVA: ' || btrim(v_p->>'comentario'));
    v_titulo_aviso := 'Comentário da EVA';
  END IF;

  UPDATE public.ti_agente_sugestoes
     SET status = 'aprovada',
         proposta = v_p,
         decidido_por = p_aprovador,
         decidido_em = now(),
         card_resultante_id = v_card_id
   WHERE id = p_id;

  INSERT INTO public.user_notifications (user_id, title, content, module, type, link)
  SELECT DISTINCT u, v_titulo_aviso, v_codigo || ' · ' || COALESCE(v_titulo, ''), 'IT', 'info', '/it/kanban'
    FROM unnest(COALESCE(v_resp, '{}')) AS u
   WHERE u IS DISTINCT FROM p_aprovador
     AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = u);

  RETURN v_card_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ti_agente_rejeitar_sugestao_como(p_id uuid, p_motivo text, p_aprovador uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.ti_agente_eh_gestor(p_aprovador) THEN
    RAISE EXCEPTION 'Sem permissão para rejeitar sugestões da EVA.' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(COALESCE(p_motivo, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da rejeição.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ti_agente_sugestoes
     SET status = 'rejeitada', decidido_por = p_aprovador, decidido_em = now(), motivo_rejeicao = btrim(p_motivo)
   WHERE id = p_id AND status = 'pendente';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sugestão não encontrada ou já decidida.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.ti_agente_aprovar_sugestao_como(uuid, jsonb, uuid) IS 'Aprova e aplica uma sugestão em nome de p_aprovador, que precisa ser gestor (ti_agente_eh_gestor). Só o servidor (service_role) chama: é o caminho dos comandos pelo WhatsApp (D29).';
COMMENT ON FUNCTION public.ti_agente_rejeitar_sugestao_como(uuid, text, uuid) IS 'Rejeita uma sugestão em nome de p_aprovador, que precisa ser gestor (ti_agente_eh_gestor). Só o servidor chama (D29).';

-- CREATE OR REPLACE mantém os privilégios; repetidos aqui para a migration valer sozinha.
REVOKE ALL ON FUNCTION public.ti_agente_eh_gestor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ti_agente_aprovar_sugestao_como(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ti_agente_rejeitar_sugestao_como(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.ti_agente_eh_gestor(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.ti_agente_aprovar_sugestao_como(uuid, jsonb, uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.ti_agente_rejeitar_sugestao_como(uuid, text, uuid) TO service_role;
  END IF;
END $$;

COMMIT;
