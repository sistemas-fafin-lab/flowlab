-- ═══════════════════════════════════════════════════════════════════════════════
-- EVA — três permissões separadas: configurar, gestor e aprovar sugestões
-- Migration: 20261015120000_eva_papeis.sql
-- (.scratch/agente-ti/issues/20-permissoes-separadas.md; plano D31)
--
-- Até aqui, canApproveAgenteTI fazia três papéis. Pedido do usuário (15/Out): separar.
--   canConfigureAgenteTI (nova)  Configurar a EVA: abas Membros e Configurações, liga/desliga,
--                                Granola, grupo da equipe, "Enviar teste".
--   canManageAgenteTI (nova)     Gestor da EVA: cobrar cards de outras pessoas, avisar o grupo,
--                                a fila do WhatsApp e o "último contato" no Início.
--   canApproveAgenteTI (a atual) Aprovar sugestões da EVA, na tela e pelo WhatsApp.
--
-- Nenhuma linha de custom_roles é alterada (D15, e escolha do usuário em 15/Out): quem tem só a
-- chave atual fica só com Aprovar até as chaves novas serem marcadas nos cargos. Admin tem as três.
--
-- Leitura (RLS): quem configura também lê a fila de mensagens (o histórico de cada membro, o
-- resultado do "Enviar teste" e a situação em Configurações), a config, as reuniões e o uso da IA.
-- O gestor lê os membros (quem tem WhatsApp, para o botão Cobrar) e a fila. Gravar membros e
-- config é só de quem configura.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.ti_agente_aprovar_sugestao_como(uuid, jsonb, uuid)') IS NULL THEN
    RAISE EXCEPTION 'Aplique 20261014160000_eva_comandos_whatsapp.sql antes desta migration.';
  END IF;
END $$;

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. RLS
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS ti_agente_config_select ON public.ti_agente_config;
CREATE POLICY ti_agente_config_select ON public.ti_agente_config
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canManageIT')
    OR public.current_user_has_permission('canApproveAgenteTI')
    OR public.current_user_has_permission('canConfigureAgenteTI')
    OR public.current_user_has_permission('canManageAgenteTI')
  );

DROP POLICY IF EXISTS ti_agente_config_update ON public.ti_agente_config;
CREATE POLICY ti_agente_config_update ON public.ti_agente_config
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canConfigureAgenteTI'))
  WITH CHECK (public.current_user_has_permission('canConfigureAgenteTI'));

DROP POLICY IF EXISTS ti_agente_membros_select ON public.ti_agente_membros;
CREATE POLICY ti_agente_membros_select ON public.ti_agente_membros
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canConfigureAgenteTI') OR public.current_user_has_permission('canManageAgenteTI'));

DROP POLICY IF EXISTS ti_agente_membros_insert ON public.ti_agente_membros;
CREATE POLICY ti_agente_membros_insert ON public.ti_agente_membros
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canConfigureAgenteTI'));

DROP POLICY IF EXISTS ti_agente_membros_update ON public.ti_agente_membros;
CREATE POLICY ti_agente_membros_update ON public.ti_agente_membros
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canConfigureAgenteTI'))
  WITH CHECK (public.current_user_has_permission('canConfigureAgenteTI'));

DROP POLICY IF EXISTS ti_agente_reunioes_select ON public.ti_agente_reunioes;
CREATE POLICY ti_agente_reunioes_select ON public.ti_agente_reunioes
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canManageIT')
    OR public.current_user_has_permission('canApproveAgenteTI')
    OR public.current_user_has_permission('canConfigureAgenteTI')
  );

DROP POLICY IF EXISTS ti_agente_mensagens_select ON public.ti_agente_mensagens;
CREATE POLICY ti_agente_mensagens_select ON public.ti_agente_mensagens
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canManageAgenteTI') OR public.current_user_has_permission('canConfigureAgenteTI'));

DROP POLICY IF EXISTS ti_agente_chamadas_ia_select ON public.ti_agente_chamadas_ia;
CREATE POLICY ti_agente_chamadas_ia_select ON public.ti_agente_chamadas_ia
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canManageIT')
    OR public.current_user_has_permission('canApproveAgenteTI')
    OR public.current_user_has_permission('canConfigureAgenteTI')
  );

DROP POLICY IF EXISTS ti_agente_comandos_select ON public.ti_agente_comandos;
CREATE POLICY ti_agente_comandos_select ON public.ti_agente_comandos
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canManageAgenteTI') OR public.current_user_has_permission('canApproveAgenteTI'));

COMMENT ON TABLE public.ti_agente_membros IS 'Pessoas que a EVA acompanha: os nomes com que aparecem nas reuniões (apelidos, RN08), o WhatsApp e a adesão à cobrança (D10). Quem configura a EVA lê e edita; o gestor lê (botão Cobrar). Tem telefone (D31).';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. FUNÇÕES
-- ═══════════════════════════════════════════════════════════════════════════════

-- A regra de current_user_has_permission para um usuário dado: admin, ou cargo com a chave;
-- removido ou desativado, nunca. Substitui ti_agente_eh_gestor, que só sabia de uma chave.
CREATE OR REPLACE FUNCTION public.ti_agente_tem_permissao(p_user uuid, p_chave text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user IS NOT NULL AND p_chave IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.user_profiles p
      LEFT JOIN public.custom_roles cr ON cr.id = p.custom_role_id
     WHERE p.id = p_user
       AND p.deleted_at IS NULL
       AND p.disabled_at IS NULL
       AND (p.role = 'admin' OR cr.permissions @> to_jsonb(ARRAY[p_chave]))
  );
$$;

COMMENT ON FUNCTION public.ti_agente_tem_permissao(uuid, text) IS 'A regra de current_user_has_permission para um usuário dado: admin, ou cargo com a chave; removido ou desativado, não. Usada nos comandos pelo WhatsApp, onde não há sessão (D29, D31).';

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
  IF NOT public.ti_agente_tem_permissao(p_aprovador, 'canApproveAgenteTI') THEN
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
  IF NOT public.ti_agente_tem_permissao(p_aprovador, 'canApproveAgenteTI') THEN
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

DROP FUNCTION IF EXISTS public.ti_agente_eh_gestor(uuid);

COMMENT ON FUNCTION public.ti_agente_aprovar_sugestao_como(uuid, jsonb, uuid) IS 'Aprova e aplica uma sugestão em nome de p_aprovador, que precisa de canApproveAgenteTI (ti_agente_tem_permissao). Só o servidor (service_role) chama: é o caminho dos comandos pelo WhatsApp (D29).';
COMMENT ON FUNCTION public.ti_agente_rejeitar_sugestao_como(uuid, text, uuid) IS 'Rejeita uma sugestão em nome de p_aprovador, que precisa de canApproveAgenteTI (ti_agente_tem_permissao). Só o servidor chama (D29).';

-- Cobranças de hoje: o número também para o gestor e para quem aprova, que podem não ter canManageIT.
CREATE OR REPLACE FUNCTION public.ti_agente_cobrancas_hoje()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.current_user_has_permission('canManageIT') OR public.current_user_has_permission('canManageAgenteTI') OR public.current_user_has_permission('canApproveAgenteTI')) THEN
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

REVOKE ALL ON FUNCTION public.ti_agente_tem_permissao(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ti_agente_aprovar_sugestao_como(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ti_agente_rejeitar_sugestao_como(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.ti_agente_tem_permissao(uuid, text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.ti_agente_aprovar_sugestao_como(uuid, jsonb, uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.ti_agente_rejeitar_sugestao_como(uuid, text, uuid) TO service_role;
  END IF;
END $$;

COMMIT;
