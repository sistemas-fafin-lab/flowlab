-- ============================================================
-- Cotações — editar as informações da cotação a qualquer momento
-- Migration: 20261019120000_quotation_info_edit.sql
--
-- As informações da cotação — título, descrição, justificativa, prioridade,
-- centro de custo, prazo de entrega (deadline) e prazo de resposta — passam a
-- ser editáveis em qualquer status, exceto cancelada e rejeitada. A política de
-- UPDATE de quotations continua aberta; a proteção vem do trigger abaixo, que
-- vale também para chamadas diretas ao Supabase:
--
--   • com usuário logado (auth.uid()): recusa em cotação cancelada/rejeitada,
--     sem canEditQuotationInfo nem canAdministerQuotations, com título vazio ou
--     prioridade fora de low/medium/high/urgent (mesma regra de
--     validateQuotationInfo no client);
--   • sem usuário logado (SQL Editor, chave de serviço): não checa nada — é a
--     saída de emergência —, mas registra como "Sistema (SQL)".
--
-- Toda edição grava em quotation_audit_logs a ação info_edited com
-- details = { coluna: { de, para } } só dos campos alterados (mesmas chaves de
-- diffQuotationInfo no client). Mudança só de status ou de outros campos passa
-- direto e não gera entrada. Erros saem como RAISE EXCEPTION (P0001) com
-- mensagem para o usuário, repassada pelo client.
-- ============================================================

-- ─── Permissão: quem cria cotações já pode corrigi-las ────────────────────────
-- O cargo Administrador recebe por nome também: ele tem todas as chaves do
-- catálogo (src/utils/permissions.test.ts).
UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canEditQuotationInfo"]'::jsonb,
       updated_at = now()
 WHERE (cr.permissions ? 'canCreateQuotations'
        OR cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canEditQuotationInfo';

-- ─── Trigger ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.quotation_guard_info_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_diff  JSONB := '{}'::jsonb;
  v_name  TEXT;
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title THEN
    v_diff := v_diff || jsonb_build_object('title', jsonb_build_object('de', OLD.title, 'para', NEW.title));
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    v_diff := v_diff || jsonb_build_object('description', jsonb_build_object('de', OLD.description, 'para', NEW.description));
  END IF;
  IF NEW.justification IS DISTINCT FROM OLD.justification THEN
    v_diff := v_diff || jsonb_build_object('justification', jsonb_build_object('de', OLD.justification, 'para', NEW.justification));
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    v_diff := v_diff || jsonb_build_object('priority', jsonb_build_object('de', OLD.priority, 'para', NEW.priority));
  END IF;
  IF NEW.cost_center IS DISTINCT FROM OLD.cost_center THEN
    v_diff := v_diff || jsonb_build_object('cost_center', jsonb_build_object('de', OLD.cost_center, 'para', NEW.cost_center));
  END IF;
  IF NEW.deadline IS DISTINCT FROM OLD.deadline THEN
    v_diff := v_diff || jsonb_build_object('deadline', jsonb_build_object('de', OLD.deadline, 'para', NEW.deadline));
  END IF;
  IF NEW.response_deadline IS DISTINCT FROM OLD.response_deadline THEN
    v_diff := v_diff || jsonb_build_object('response_deadline', jsonb_build_object('de', OLD.response_deadline, 'para', NEW.response_deadline));
  END IF;

  IF v_diff = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NOT NULL THEN
    IF OLD.status = 'cancelled' THEN
      RAISE EXCEPTION 'Cotação cancelada não pode ter as informações editadas.';
    END IF;
    IF OLD.status = 'rejected' THEN
      RAISE EXCEPTION 'Cotação rejeitada não pode ter as informações editadas.';
    END IF;
    IF NOT (public.current_user_has_permission('canEditQuotationInfo')
            OR public.current_user_has_permission('canAdministerQuotations')) THEN
      RAISE EXCEPTION 'Você não tem permissão para editar as informações da cotação.';
    END IF;
    IF NEW.title IS NULL OR NEW.title ~ '^\s*$' THEN
      RAISE EXCEPTION 'Informe o título da cotação.';
    END IF;
    IF NEW.priority IS NULL OR NEW.priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
      RAISE EXCEPTION 'Prioridade inválida: use baixa, média, alta ou urgente.';
    END IF;

    SELECT name INTO v_name FROM user_profiles WHERE id = v_actor;
  END IF;

  INSERT INTO quotation_audit_logs (quotation_id, action, performed_by, performed_by_name, details)
  VALUES (
    NEW.id,
    'info_edited',
    COALESCE(v_actor, '00000000-0000-0000-0000-000000000000'::uuid),
    CASE WHEN v_actor IS NULL THEN 'Sistema (SQL)' ELSE COALESCE(v_name, 'Usuário') END,
    v_diff
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_quotation_guard_info_edit ON public.quotations;

CREATE TRIGGER trigger_quotation_guard_info_edit
  BEFORE UPDATE OF title, description, justification, priority, cost_center, deadline, response_deadline
  ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.quotation_guard_info_edit();

COMMENT ON FUNCTION public.quotation_guard_info_edit()
  IS 'Informações da cotação: com usuário logado, só fora de cancelada/rejeitada, com canEditQuotationInfo ou canAdministerQuotations, título não vazio e prioridade válida; sem usuário (SQL), sem checagem. Sempre grava info_edited com { coluna: { de, para } }. Mesma regra de validateQuotationInfo/diffQuotationInfo no client.';
