-- ═══════════════════════════════════════════════════════════════════════════════
-- EVA, o agente de TI — comandos pelo WhatsApp e grupo da equipe
-- Migration: 20261014160000_eva_comandos_whatsapp.sql
-- (.scratch/agente-ti/issues/18-comandos-whatsapp.md; plano D29)
--
-- 1. ti_agente_config: o grupo da equipe (escolhido em Configurações a partir da lista
--    que o script da VPS lê do WAHA) e os liga/desliga do fechamento do dia e do resumo
--    de reunião no grupo.
-- 2. ti_agente_mensagens: destino de grupo (chat_id_destino) e o tipo 'grupo'.
-- 3. ti_agente_comandos: o que um gestor pediu pelo WhatsApp e espera o "SIM" (cobrar,
--    aprovar, rejeitar, avisar o grupo), e a última lista de sugestões numerada que a EVA
--    mandou para ele ("aprovar 1 e 3" vale para ela).
-- 4. Aprovar e rejeitar "como" um gestor: pelo WhatsApp não há sessão (auth.uid()), então
--    o servidor (service role) informa quem decidiu, e a função confere a permissão dele
--    com user_has_permission. As RPCs da tela passam a usar a mesma lógica.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.ti_agente_sugestoes') IS NULL OR to_regprocedure('public.ti_agente_aprovar_sugestao(uuid, jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Aplique 20261013150000_eva_tabelas.sql e 20261013151000_eva_rpcs.sql antes desta migration.';
  END IF;
  IF to_regprocedure('public.user_has_permission(uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.user_has_permission(uuid, text) não existe (20260409120000_dynamic_roles_system.sql).';
  END IF;
END $$;

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. CONFIGURAÇÃO: grupo da equipe
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.ti_agente_config ADD COLUMN IF NOT EXISTS whatsapp_grupo_id          text;
ALTER TABLE public.ti_agente_config ADD COLUMN IF NOT EXISTS whatsapp_grupo_nome        text;
ALTER TABLE public.ti_agente_config ADD COLUMN IF NOT EXISTS waha_grupos                jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.ti_agente_config ADD COLUMN IF NOT EXISTS waha_grupos_em             timestamptz;
ALTER TABLE public.ti_agente_config ADD COLUMN IF NOT EXISTS fechamento_diario_ativo    boolean NOT NULL DEFAULT false;
ALTER TABLE public.ti_agente_config ADD COLUMN IF NOT EXISTS resumo_reuniao_grupo_ativo boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ti_agente_config_grupo_check') THEN
    ALTER TABLE public.ti_agente_config
      ADD CONSTRAINT ti_agente_config_grupo_check CHECK (whatsapp_grupo_id IS NULL OR whatsapp_grupo_id ~ '@g\.us$');
  END IF;
END $$;

COMMENT ON COLUMN public.ti_agente_config.whatsapp_grupo_id IS 'Grupo da equipe no WhatsApp (…@g.us), escolhido em Configurações. Recebe o fechamento do dia, o resumo de reunião e os avisos pedidos por gestor.';
COMMENT ON COLUMN public.ti_agente_config.waha_grupos IS 'Grupos da sessão do WAHA ([{id, nome}]), gravados pelo script da VPS a cada 30 min: a Vercel não alcança o WAHA (D9).';
COMMENT ON COLUMN public.ti_agente_config.fechamento_diario_ativo IS 'Fechamento do dia no grupo (dias úteis, 18h): concluídas hoje, atrasadas e o que vence amanhã.';
COMMENT ON COLUMN public.ti_agente_config.resumo_reuniao_grupo_ativo IS 'Ao terminar a análise de uma reunião, manda ao grupo as decisões e quantas sugestões aguardam aprovação.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. MENSAGENS: destino de grupo
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.ti_agente_mensagens ADD COLUMN IF NOT EXISTS chat_id_destino text;

ALTER TABLE public.ti_agente_mensagens DROP CONSTRAINT IF EXISTS ti_agente_mensagens_tipo_check;
ALTER TABLE public.ti_agente_mensagens ADD CONSTRAINT ti_agente_mensagens_tipo_check
  CHECK (tipo IN ('cobranca', 'cobranca_manual', 'teste', 'confirmacao', 'recebida', 'grupo'));

COMMENT ON COLUMN public.ti_agente_mensagens.chat_id_destino IS 'Destino fora da lista de membros: o grupo da equipe (…@g.us). Quando preenchido, o script da VPS envia para ele, não para o membro.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. COMANDOS PELO WHATSAPP (só o servidor grava; gestor lê)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ti_agente_comandos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id    uuid NOT NULL REFERENCES public.ti_agente_membros(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  tipo         text NOT NULL
    CONSTRAINT ti_agente_comandos_tipo_check CHECK (tipo IN ('cobrar', 'aprovar', 'rejeitar', 'avisar_grupo', 'lista_sugestoes')),
  dados        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status       text NOT NULL DEFAULT 'aguardando'
    CONSTRAINT ti_agente_comandos_status_check CHECK (status IN ('aguardando', 'executado', 'cancelado', 'lista')),
  resultado    text,
  mensagem_id  uuid REFERENCES public.ti_agente_mensagens(id) ON DELETE SET NULL,
  expira_em    timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  decidido_em  timestamptz
);

COMMENT ON TABLE public.ti_agente_comandos IS 'Comandos de gestor pelo WhatsApp (D29). Cobrar, aprovar, rejeitar e avisar o grupo ficam "aguardando" o SIM por 30 min; "lista_sugestoes" guarda a numeração da última lista enviada (2 h).';

CREATE INDEX IF NOT EXISTS ti_agente_comandos_membro_idx ON public.ti_agente_comandos (membro_id, created_at DESC);

ALTER TABLE public.ti_agente_comandos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_agente_comandos_select ON public.ti_agente_comandos;
CREATE POLICY ti_agente_comandos_select ON public.ti_agente_comandos
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canApproveAgenteTI'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. APROVAR E REJEITAR "COMO" UM GESTOR
-- ═══════════════════════════════════════════════════════════════════════════════

-- A lógica é a mesma de 20261013151000_eva_rpcs.sql, agora com quem decide como parâmetro.
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
  IF p_aprovador IS NULL OR NOT public.user_has_permission(p_aprovador, 'canApproveAgenteTI') THEN
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

COMMENT ON FUNCTION public.ti_agente_aprovar_sugestao_como(uuid, jsonb, uuid) IS 'Aprova e aplica uma sugestão em nome de p_aprovador, que precisa de canApproveAgenteTI (user_has_permission). Só o servidor (service_role) chama: é o caminho dos comandos pelo WhatsApp (D29).';

-- A RPC da tela: confere a sessão e delega.
CREATE OR REPLACE FUNCTION public.ti_agente_aprovar_sugestao(p_id uuid, p_proposta jsonb DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_has_permission('canApproveAgenteTI') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar sugestões da EVA.' USING ERRCODE = '42501';
  END IF;
  RETURN public.ti_agente_aprovar_sugestao_como(p_id, p_proposta, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.ti_agente_rejeitar_sugestao_como(p_id uuid, p_motivo text, p_aprovador uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_aprovador IS NULL OR NOT public.user_has_permission(p_aprovador, 'canApproveAgenteTI') THEN
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

COMMENT ON FUNCTION public.ti_agente_rejeitar_sugestao_como(uuid, text, uuid) IS 'Rejeita uma sugestão em nome de p_aprovador (canApproveAgenteTI). Só o servidor chama (D29).';

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
  PERFORM public.ti_agente_rejeitar_sugestao_como(p_id, p_motivo, auth.uid());
END;
$$;

-- As versões "como" nunca são chamadas pelo cliente: só pelo servidor ou por dentro das RPCs.
REVOKE ALL ON FUNCTION public.ti_agente_aprovar_sugestao_como(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ti_agente_rejeitar_sugestao_como(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.ti_agente_aprovar_sugestao_como(uuid, jsonb, uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.ti_agente_rejeitar_sugestao_como(uuid, text, uuid) TO service_role;
  END IF;
END $$;

COMMIT;
