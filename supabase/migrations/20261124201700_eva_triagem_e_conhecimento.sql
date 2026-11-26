-- ═══════════════════════════════════════════════════════════════════════════════
-- EVA — triagem de todo chamado e base de conhecimento (D45, issue 33)
-- Migration: 20261124201700_eva_triagem_e_conhecimento.sql
--
-- 1. ti_agente_sugestoes.origem ganha 'triagem': o relógio (a cada 10 min) analisa os chamados
--    abertos pela tela de Solicitações de TI e grava a sugestão promover_card, como já fazia
--    com os do LAB-BRAIN.
-- 2. ti_agente_config.triagem_desde: só os chamados abertos depois disso entram na triagem. A
--    coluna nasce com a hora em que esta migration é aplicada: o que já estava na fila não vira
--    uma enxurrada de sugestões. NULL desliga a triagem.
-- 3. A finalidade 'rascunho_resolucao' no registro de chamadas de IA (o botão "Rascunhar com a
--    EVA" do Resolver chamado).
-- 4. Rejeitar a sugestão de um chamado da TRIAGEM não cancela o chamado: ele só fica fora do
--    Kanban e segue em Solicitações de TI. Só a do LAB-BRAIN cancela, como antes
--    (20261113160000_eva_rejeitar_promover_card.sql, o corpo de lá com a condição de origem).
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.ti_agente_rejeitar_sugestao_como(uuid, text, uuid)') IS NULL THEN
    RAISE EXCEPTION 'Aplique 20261015120000_eva_papeis.sql antes desta migration.';
  END IF;
END $$;

BEGIN;

-- ── 1. A origem da triagem ──────────────────────────────────────────────────
ALTER TABLE public.ti_agente_sugestoes DROP CONSTRAINT IF EXISTS ti_agente_sugestoes_origem_check;
ALTER TABLE public.ti_agente_sugestoes ADD CONSTRAINT ti_agente_sugestoes_origem_check
  CHECK (origem IN ('reuniao', 'whatsapp', 'comentario', 'chat', 'lab-brain', 'triagem'));

-- ── 2. Desde quando a triagem olha os chamados ──────────────────────────────
ALTER TABLE public.ti_agente_config ADD COLUMN IF NOT EXISTS triagem_desde timestamptz DEFAULT now();
COMMENT ON COLUMN public.ti_agente_config.triagem_desde IS
  'D45: a triagem da EVA só analisa chamados da tela abertos depois disso. NULL desliga a triagem.';

-- ── 3. A finalidade do rascunho da resolução ────────────────────────────────
ALTER TABLE public.ti_agente_chamadas_ia DROP CONSTRAINT IF EXISTS ti_agente_chamadas_ia_finalidade_check;
ALTER TABLE public.ti_agente_chamadas_ia ADD CONSTRAINT ti_agente_chamadas_ia_finalidade_check
  CHECK (finalidade IN ('analise_reuniao', 'resposta_whatsapp', 'chat', 'analise_chamado', 'transcricao_audio', 'rascunho_resolucao'));
COMMENT ON COLUMN public.ti_agente_chamadas_ia.finalidade IS
  'analise_reuniao, resposta_whatsapp, chat, analise_chamado (chamado do LAB-BRAIN ou da triagem), transcricao_audio (D43) ou rascunho_resolucao (D45).';

-- ── 4. Rejeitar: só o chamado do LAB-BRAIN é cancelado ──────────────────────
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

  -- D45: a da triagem (chamado aberto pela tela) não cancela nada: o chamado segue fora do Kanban.
  IF v_sug.tipo = 'promover_card' AND v_sug.card_id IS NOT NULL AND v_sug.origem = 'lab-brain' THEN
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

COMMENT ON FUNCTION public.ti_agente_rejeitar_sugestao_como(uuid, text, uuid) IS 'Rejeita uma sugestão em nome de p_aprovador, que precisa de canApproveAgenteTI (ti_agente_tem_permissao), com motivo obrigatório. promover_card do LAB-BRAIN cancela o chamado fora do Kanban e grava o motivo como resolução; o da triagem (D45) só fica fora do Kanban. Só o servidor chama (D29) e, por dentro, ti_agente_rejeitar_sugestao.';

-- CREATE OR REPLACE mantém os GRANTs; reafirmados aqui.
REVOKE ALL ON FUNCTION public.ti_agente_rejeitar_sugestao_como(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.ti_agente_rejeitar_sugestao_como(uuid, text, uuid) TO service_role;
  END IF;
END $$;

COMMIT;
