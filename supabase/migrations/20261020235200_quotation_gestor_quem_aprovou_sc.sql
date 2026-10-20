-- ============================================================
-- Cotações — gestor do pedido travado é quem aprovou a SC
-- Migration: 20261020235200_quotation_gestor_quem_aprovou_sc.sql
-- (.scratch/solicitacoes-aprovacao-gestor/issues/05-gestor-do-pedido-e-quem-aprovou-a-sc.md)
--
-- Revisão de 20261007180000_quotation_requester_manager_rule.sql. Em Compras
-- a origem travada passa a ser requests.approved_by_user_id (quem aprovou a
-- SC), não mais requested_by_user_id. SC aprovada por admin no lugar
-- (decided_without_approver, sem aprovador no RH) não trava: o comprador
-- escolhe. Contratação não muda (maintenance_requests.requester_id).
--
-- Depende de 20261020230000_sc_decisao_pelo_aprovador.sql
-- (decided_without_approver). Mesma regra de resolveRequesterManagerChoice
-- no client.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'decided_without_approver'
  ) THEN
    RAISE EXCEPTION 'Aplique antes 20261020230000_sc_decisao_pelo_aprovador.sql.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.quotation_enforce_requester_manager()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor       UUID := auth.uid();
  v_origin_id   UUID;
  v_origin_name TEXT;
BEGIN
  IF NEW.requester_manager_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.requester_manager_id IS NOT DISTINCT FROM OLD.requester_manager_id THEN
    RETURN NEW;
  END IF;

  IF NEW.requester_manager_id::text = NEW.created_by OR NEW.requester_manager_id = v_actor THEN
    RAISE EXCEPTION 'O gestor do pedido não pode ser quem criou a cotação nem quem a está enviando. Escolha outra pessoa.';
  END IF;

  IF NEW.quotation_type = 'contratacao' THEN
    SELECT requester_id INTO v_origin_id
      FROM maintenance_requests WHERE id = NEW.maintenance_request_id;
  ELSE
    SELECT CASE WHEN decided_without_approver THEN NULL ELSE approved_by_user_id END INTO v_origin_id
      FROM requests WHERE id = NEW.request_id;
  END IF;

  -- Origem que não trava: desconhecida (inclusive SC aprovada por admin no
  -- lugar), é o comprador / quem está gravando (seria autoaprovação) ou está
  -- inativa.
  IF v_origin_id IS NULL
     OR v_origin_id::text = NEW.created_by
     OR v_origin_id = v_actor THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_origin_name
    FROM user_profiles
   WHERE id = v_origin_id AND is_active = TRUE AND disabled_at IS NULL;

  IF v_origin_name IS NOT NULL AND NEW.requester_manager_id <> v_origin_id THEN
    RAISE EXCEPTION 'O gestor do pedido desta cotação é % (%) e não pode ser trocado.',
      v_origin_name,
      CASE WHEN NEW.quotation_type = 'contratacao' THEN 'quem abriu a solicitação de manutenção' ELSE 'quem aprovou a Solicitação de Compras' END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.quotation_enforce_requester_manager()
  IS 'Gestor do pedido: nunca o comprador (created_by) nem quem grava (auth.uid()); travado em quem aprovou a SC (exceto admin no lugar, decided_without_approver) ou em quem abriu a solicitação de manutenção, quando ativo e diferente deles. Mesma regra de resolveRequesterManagerChoice no client.';
