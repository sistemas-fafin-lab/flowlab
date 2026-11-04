-- ═══════════════════════════════════════════════════════════════════════════════
-- EVA — aviso para a equipe toda e gestor executando o próprio pedido
-- Migration: 20261104120000_eva_aviso_equipe_gestor_direto.sql
-- (.scratch/agente-ti/issues/25-aviso-para-a-equipe.md, D36;
--  .scratch/agente-ti/issues/26-gestor-executa-direto.md, D37)
--
-- D36 — pedido do usuário (04/Nov): "ela não consegue encaminhar para todos os membros de uma
-- vez". O gestor avisa a equipe toda: uma mensagem no privado de cada um (tipo `aviso`, como na
-- D32) e, para quem não tem WhatsApp, uma no grupo citando os nomes (D35). Pelo WhatsApp, o pedido
-- que espera o SIM é o comando novo `avisar_equipe`.
--
-- D37 — pedido do usuário (04/Nov): "se o usuário for gestor, ele pode pedir para a eva executar
-- ações diretamente, sem necessidade de ir para a fila de aprovação, tanto via chat quanto
-- whatsapp". O gestor (canManageAgenteTI) confirma e a EVA aplica na hora, como já fazia quem
-- aprova. Vale só para a sugestão que o PRÓPRIO gestor pediu (chat, comentário da EVA ou WhatsApp):
-- sugestão de reunião ou de outra pessoa continua só para quem aprova (canApproveAgenteTI).
-- A sugestão continua sendo gravada e fica "aprovada" por ele: o histórico em EVA → Sugestões não muda.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.ti_agente_pode(text)') IS NULL THEN
    RAISE EXCEPTION 'Aplique 20261015160000_eva_papeis_por_pessoa.sql antes desta migration.';
  END IF;
END $$;

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. D36: o comando "avisar_equipe" (WhatsApp, com SIM)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.ti_agente_comandos DROP CONSTRAINT IF EXISTS ti_agente_comandos_tipo_check;
ALTER TABLE public.ti_agente_comandos ADD CONSTRAINT ti_agente_comandos_tipo_check
  CHECK (tipo IN ('cobrar', 'aprovar', 'rejeitar', 'avisar_grupo', 'lista_sugestoes', 'avisar_pessoa', 'avisar_equipe'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. D37: aprovar em nome de alguém — quem aprova, qualquer sugestão; o gestor, só a dele
-- ═══════════════════════════════════════════════════════════════════════════════
-- Mesmo corpo de 20261015120000_eva_papeis.sql; muda só a conferência de quem pode.

CREATE OR REPLACE FUNCTION public.ti_agente_aprovar_sugestao_como(p_id uuid, p_proposta jsonb, p_aprovador uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sug          public.ti_agente_sugestoes%ROWTYPE;
  v_aprova       boolean;
  v_p            jsonb;
  v_card_id      uuid;
  v_codigo       text;
  v_titulo       text;
  v_resp         uuid[];
  v_coluna       text;
  v_titulo_aviso text;
BEGIN
  v_aprova := public.ti_agente_tem_permissao(p_aprovador, 'canApproveAgenteTI');
  IF NOT v_aprova AND NOT public.ti_agente_tem_permissao(p_aprovador, 'canManageAgenteTI') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar sugestões da EVA.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sug FROM public.ti_agente_sugestoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sugestão não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  -- D37: o gestor aplica o que ele mesmo pediu; o resto da fila é de quem aprova.
  IF NOT v_aprova AND (v_sug.proposta_por IS DISTINCT FROM p_aprovador OR v_sug.origem NOT IN ('chat', 'comentario', 'whatsapp')) THEN
    RAISE EXCEPTION 'O gestor aplica só os próprios pedidos; esta sugestão é de quem aprova sugestões da EVA.' USING ERRCODE = '42501';
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

COMMENT ON FUNCTION public.ti_agente_aprovar_sugestao_como(uuid, jsonb, uuid) IS 'Aprova e aplica uma sugestão em nome de p_aprovador: quem aprova (canApproveAgenteTI), qualquer uma; o gestor (canManageAgenteTI), só a que ele mesmo pediu pelo chat, comentário ou WhatsApp (D37). Só o servidor chama (service_role) e, por dentro, ti_agente_propor_sugestao.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. D37: propor pela tela (chat e comentários) — o gestor também propõe e aplica na hora
-- ═══════════════════════════════════════════════════════════════════════════════
-- Mesmo corpo de 20261015160000_eva_papeis_por_pessoa.sql, com o gestor nas duas conferências.
-- Aplicar passa direto por ti_agente_aprovar_sugestao_como em nome de quem pediu (a regra da seção 2),
-- e não por ti_agente_aprovar_sugestao, que é a tela de Sugestões, só de quem aprova.

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
  IF NOT (public.current_user_has_permission('canManageIT')
          OR public.ti_agente_pode('canApproveAgenteTI')
          OR public.ti_agente_pode('canManageAgenteTI')) THEN
    RAISE EXCEPTION 'Sem permissão para propor ações da EVA.' USING ERRCODE = '42501';
  END IF;
  IF p_aprovar AND NOT (public.ti_agente_pode('canApproveAgenteTI') OR public.ti_agente_pode('canManageAgenteTI')) THEN
    RAISE EXCEPTION 'Só gestores e quem aprova sugestões executam ações da EVA na hora.' USING ERRCODE = '42501';
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
    PERFORM public.ti_agente_aprovar_sugestao_como(v_id, NULL, auth.uid());
  END IF;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.ti_agente_propor_sugestao(text, uuid, jsonb, text, text, boolean) IS 'Grava uma proposta da EVA vinda do chat ou de um comentário (D28). Com p_aprovar, quem aprova ou o gestor (D37) já aplica na hora, em nome de quem pediu.';

-- As permissões de execução não mudam: CREATE OR REPLACE mantém os GRANTs; reafirmados aqui.
REVOKE ALL ON FUNCTION public.ti_agente_aprovar_sugestao_como(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.ti_agente_aprovar_sugestao_como(uuid, jsonb, uuid) TO service_role;
  END IF;
END $$;

COMMIT;
