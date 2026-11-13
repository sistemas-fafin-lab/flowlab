-- ═══════════════════════════════════════════════════════════════════════════════
-- EVA — promover o chamado do LAB-BRAIN por fora da fila substitui a sugestão
-- Migration: 20261113170000_eva_promover_card_substituida.sql
-- (.scratch/lab-brain-aprovacao-eva/spec.md: Banco (Substituição), histórias 21 e 22;
--  .scratch/lab-brain-aprovacao-eva/issues/03-promocao-manual-substitui-a-sugestao.md)
--
-- Quando um chamado sai de "fora do Kanban" (kanban_hidden true → false) por qualquer caminho,
-- a sugestão `promover_card` pendente ligada a ele (card_id) vira `substituida` e sai da fila.
-- Vale para a promoção manual em Solicitações de TI (KanbanPromoteModal) e para caminhos futuros.
-- Como os outros usos de `substituida` (reanálise de reunião), decidido_por/decidido_em ficam
-- vazios: ninguém decidiu a sugestão.
--
-- A aprovação pela RPC também tira o chamado de "fora do Kanban", e faz isso antes de marcar a
-- sugestão como `aprovada`. Para o trigger não tocar nela, ti_agente_aprovar_sugestao_como
-- grava o id da sugestão no GUC local da transação `ti_agente.aprovando` em volta do UPDATE do
-- chamado, e o trigger pula essa sugestão. Só a própria sugestão fica de fora.
--
-- O trigger é SECURITY DEFINER: quem promove pela tela (canManageIT) não tem UPDATE em
-- ti_agente_sugestoes pela RLS. Ele só muda status de pendente para substituida, de sugestões
-- promover_card do próprio chamado que acabou de mudar.
--
-- Idempotente: CREATE OR REPLACE e DROP TRIGGER IF EXISTS. O corpo da RPC é o de
-- 20261113150000_eva_promover_card_lab_brain.sql, com o GUC no ramo promover_card.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_ti_agente_sugestoes_promover_card') THEN
    RAISE EXCEPTION 'Aplique 20261113150000_eva_promover_card_lab_brain.sql antes desta migration.';
  END IF;
END $$;

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Trigger: chamado saiu de "fora do Kanban" → sugestão pendente substituída
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ti_agente_substituir_promover_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Sugestão que a RPC de aprovação está aprovando nesta transação ('' fora dela).
  v_aprovando text := COALESCE(current_setting('ti_agente.aprovando', true), '');
BEGIN
  UPDATE public.ti_agente_sugestoes
     SET status = 'substituida'
   WHERE card_id = NEW.id
     AND tipo = 'promover_card'
     AND status = 'pendente'
     AND id::text IS DISTINCT FROM NULLIF(v_aprovando, '');
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.ti_agente_substituir_promover_card() IS 'Trigger de it_requests: quando o chamado sai de "fora do Kanban", a sugestão promover_card pendente dele vira substituida. Pula a sugestão que ti_agente_aprovar_sugestao_como está aprovando (GUC local ti_agente.aprovando).';

REVOKE ALL ON FUNCTION public.ti_agente_substituir_promover_card() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_it_requests_substituir_promover_card ON public.it_requests;
CREATE TRIGGER trg_it_requests_substituir_promover_card
  AFTER UPDATE OF kanban_hidden ON public.it_requests
  FOR EACH ROW
  WHEN (OLD.kanban_hidden AND NOT NEW.kanban_hidden)
  EXECUTE FUNCTION public.ti_agente_substituir_promover_card();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Aprovar pela RPC não substitui a própria sugestão
-- ═══════════════════════════════════════════════════════════════════════════════

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

  ELSIF v_sug.tipo = 'promover_card' THEN
    -- Chamado do LAB-BRAIN: sai de "fora do Kanban" com a proposta, na mesma transação.
    -- A situação segue a regra de coluna de atualizar_card. Projeto e sprint não entram.
    IF v_sug.card_id IS NULL THEN
      RAISE EXCEPTION 'O chamado desta sugestão não existe mais.' USING ERRCODE = 'P0002';
    END IF;
    v_coluna := COALESCE(NULLIF(v_p->>'kanban_status', ''), 'todo');
    -- O trigger de substituição (trg_it_requests_substituir_promover_card) pula esta sugestão:
    -- ela vira aprovada logo abaixo.
    PERFORM set_config('ti_agente.aprovando', p_id::text, true);
    UPDATE public.it_requests r SET
      kanban_hidden = false,
      kanban_status = v_coluna,
      status = CASE
        WHEN v_coluna = 'done' THEN 'resolved'
        WHEN r.status = 'resolved' THEN 'in_progress'
        ELSE r.status END,
      due_date = CASE WHEN v_p ? 'prazo' THEN public.ti_agente_prazo_para_due_date(v_p->>'prazo') ELSE r.due_date END,
      assigned_to = CASE WHEN jsonb_typeof(v_p->'responsaveis') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(v_p->'responsaveis')::uuid) ELSE r.assigned_to END,
      priority = COALESCE(NULLIF(v_p->>'prioridade', ''), r.priority)
    WHERE r.id = v_sug.card_id
      AND r.kanban_hidden
      AND r.status <> 'cancelled'
    RETURNING r.id, r.codigo, r.title, r.assigned_to INTO v_card_id, v_codigo, v_titulo, v_resp;
    IF NOT FOUND THEN
      IF EXISTS (SELECT 1 FROM public.it_requests WHERE id = v_sug.card_id AND status = 'cancelled') THEN
        RAISE EXCEPTION 'O chamado desta sugestão foi cancelado.' USING ERRCODE = '22023';
      END IF;
      IF EXISTS (SELECT 1 FROM public.it_requests WHERE id = v_sug.card_id) THEN
        RAISE EXCEPTION 'O chamado desta sugestão já está no Kanban.' USING ERRCODE = '22023';
      END IF;
      RAISE EXCEPTION 'O chamado desta sugestão não existe mais.' USING ERRCODE = 'P0002';
    END IF;
    -- Fim da exclusão, depois do IF NOT FOUND (PERFORM mexe no FOUND): outro chamado promovido
    -- depois, na mesma transação, substitui normalmente.
    PERFORM set_config('ti_agente.aprovando', '', true);
    v_titulo_aviso := 'Chamado do LAB-BRAIN no Kanban';

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

COMMENT ON FUNCTION public.ti_agente_aprovar_sugestao_como(uuid, jsonb, uuid) IS 'Aprova e aplica uma sugestão em nome de p_aprovador: quem aprova (canApproveAgenteTI), qualquer uma; o gestor (canManageAgenteTI), só a que ele mesmo pediu pelo chat, comentário ou WhatsApp (D37). promover_card tira o chamado do LAB-BRAIN de fora do Kanban com a proposta. Só o servidor chama (service_role) e, por dentro, ti_agente_aprovar_sugestao e ti_agente_propor_sugestao.';

-- CREATE OR REPLACE mantém os GRANTs; reafirmados aqui.
REVOKE ALL ON FUNCTION public.ti_agente_aprovar_sugestao_como(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.ti_agente_aprovar_sugestao_como(uuid, jsonb, uuid) TO service_role;
  END IF;
END $$;

COMMIT;
