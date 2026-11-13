-- ═══════════════════════════════════════════════════════════════════════════════
-- EVA — rejeitar a sugestão de um chamado do LAB-BRAIN cancela o chamado
-- Migration: 20261113160000_eva_rejeitar_promover_card.sql
-- (.scratch/lab-brain-aprovacao-eva/spec.md: Banco (Rejeição);
--  .scratch/lab-brain-aprovacao-eva/issues/02-rejeitar-cancela-o-chamado.md)
--
-- Rejeitar uma sugestão `promover_card` cancela, na mesma transação, o chamado ligado a ela
-- (card_id). O motivo, que já era obrigatório, vira a resolução do chamado (resolution) e entra
-- na conversa dele como mensagem `resolution`, como faz it_resolver_chamado. A consulta do
-- LAB-BRAIN devolve esse texto em `resolucao` quando a situação é `cancelled`.
--
-- Casos do chamado:
--   - pendente ou em andamento, fora do Kanban → cancelado com o motivo;
--   - já no Kanban (promovido por fora) → recusa: cancelar um card do board por uma sugestão
--     velha seria pior que deixá-la na fila (a issue 03 a marca como substituída);
--   - já resolvido, já cancelado ou apagado → só a sugestão é rejeitada.
--
-- A tela (ti_agente_rejeitar_sugestao) e o WhatsApp passam por ti_agente_rejeitar_sugestao_como,
-- que confere canApproveAgenteTI na primeira linha. Ela é SECURITY DEFINER e ignora a RLS de
-- it_requests: essa conferência é a única barreira.
--
-- Idempotente: CREATE OR REPLACE. O corpo é o de 20261015120000_eva_papeis.sql, com o ramo novo.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.ti_agente_rejeitar_sugestao_como(uuid, text, uuid)') IS NULL THEN
    RAISE EXCEPTION 'Aplique 20261015120000_eva_papeis.sql antes desta migration.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_ti_agente_sugestoes_promover_card') THEN
    RAISE EXCEPTION 'Aplique 20261113150000_eva_promover_card_lab_brain.sql antes desta migration.';
  END IF;
END $$;

BEGIN;

CREATE OR REPLACE FUNCTION public.ti_agente_rejeitar_sugestao_como(p_id uuid, p_motivo text, p_aprovador uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sug    public.ti_agente_sugestoes%ROWTYPE;
  v_motivo text := btrim(COALESCE(p_motivo, ''));
BEGIN
  IF NOT public.ti_agente_tem_permissao(p_aprovador, 'canApproveAgenteTI') THEN
    RAISE EXCEPTION 'Sem permissão para rejeitar sugestões da EVA.' USING ERRCODE = '42501';
  END IF;
  IF v_motivo = '' THEN
    RAISE EXCEPTION 'Informe o motivo da rejeição.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_sug FROM public.ti_agente_sugestoes WHERE id = p_id AND status = 'pendente' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sugestão não encontrada ou já decidida.' USING ERRCODE = 'P0002';
  END IF;

  IF v_sug.tipo = 'promover_card' AND v_sug.card_id IS NOT NULL THEN
    -- Chamado do LAB-BRAIN: cancelado com o motivo, que o LAB-BRAIN repassa ao solicitante.
    UPDATE public.it_requests
       SET status = 'cancelled', resolution = v_motivo
     WHERE id = v_sug.card_id
       AND kanban_hidden
       AND status IN ('pending', 'in_progress');
    IF FOUND THEN
      INSERT INTO public.it_task_comments (task_id, user_id, content, kind)
      VALUES (v_sug.card_id, p_aprovador, v_motivo, 'resolution');
    ELSIF EXISTS (SELECT 1 FROM public.it_requests
                   WHERE id = v_sug.card_id AND NOT kanban_hidden AND status IN ('pending', 'in_progress')) THEN
      RAISE EXCEPTION 'O chamado desta sugestão já está no Kanban.' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.ti_agente_sugestoes
     SET status = 'rejeitada', decidido_por = p_aprovador, decidido_em = now(), motivo_rejeicao = v_motivo
   WHERE id = p_id;
END;
$$;

COMMENT ON FUNCTION public.ti_agente_rejeitar_sugestao_como(uuid, text, uuid) IS 'Rejeita uma sugestão em nome de p_aprovador, que precisa de canApproveAgenteTI (ti_agente_tem_permissao), com motivo obrigatório. promover_card cancela o chamado do LAB-BRAIN fora do Kanban e grava o motivo como resolução. Só o servidor chama (D29) e, por dentro, ti_agente_rejeitar_sugestao.';

-- CREATE OR REPLACE mantém os GRANTs; reafirmados aqui.
REVOKE ALL ON FUNCTION public.ti_agente_rejeitar_sugestao_como(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.ti_agente_rejeitar_sugestao_como(uuid, text, uuid) TO service_role;
  END IF;
END $$;

COMMIT;
