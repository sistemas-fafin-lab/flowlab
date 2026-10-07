-- ============================================================
-- Cotações — regra do "Gestor do pedido" no banco
-- Migration: 20261007180000_quotation_requester_manager_rule.sql
--
-- Antes o comprador escolhia qualquer usuário ativo como gestor do pedido,
-- inclusive ele mesmo — e, com alçada, aprovava a própria cotação direto
-- (dispensa da etapa 2). A regra passa a valer aqui, não só na tela
-- (resolveRequesterManagerChoice, mesma regra no client):
--
--   • o gestor nunca é quem criou a cotação (created_by) nem quem está
--     gravando (auth.uid());
--   • quem abriu a origem — a SC (requests.requested_by_user_id) em Compras,
--     a solicitação de manutenção (maintenance_requests.requester_id) em
--     Contratação — é o gestor, sem troca, se estiver ativo e não for o
--     comprador nem quem está gravando. Fora isso o comprador escolhe.
--
-- Só age quando requester_manager_id muda para um valor não nulo (envio para
-- aprovação e troca de gestor). Erros saem como RAISE EXCEPTION (P0001) com
-- mensagem para o usuário, repassada pelo client.
-- ============================================================

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
    SELECT requested_by_user_id INTO v_origin_id
      FROM requests WHERE id = NEW.request_id;
  END IF;

  -- Origem que não trava: desconhecida, é o comprador / quem está gravando
  -- (seria autoaprovação) ou está inativa.
  IF v_origin_id IS NULL
     OR v_origin_id::text = NEW.created_by
     OR v_origin_id = v_actor THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_origin_name
    FROM user_profiles
   WHERE id = v_origin_id AND is_active = TRUE AND disabled_at IS NULL;

  IF v_origin_name IS NOT NULL AND NEW.requester_manager_id <> v_origin_id THEN
    RAISE EXCEPTION 'O gestor do pedido desta cotação é % (quem abriu a %) e não pode ser trocado.',
      v_origin_name,
      CASE WHEN NEW.quotation_type = 'contratacao' THEN 'solicitação de manutenção' ELSE 'Solicitação de Compras' END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_quotation_enforce_requester_manager ON public.quotations;

CREATE TRIGGER trigger_quotation_enforce_requester_manager
  BEFORE INSERT OR UPDATE OF requester_manager_id ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.quotation_enforce_requester_manager();

COMMENT ON FUNCTION public.quotation_enforce_requester_manager()
  IS 'Gestor do pedido: nunca o comprador (created_by) nem quem grava (auth.uid()); travado em quem abriu a SC/solicitação de manutenção quando ativo e diferente deles. Mesma regra de resolveRequesterManagerChoice no client.';
