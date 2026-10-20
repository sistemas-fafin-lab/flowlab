-- ═══════════════════════════════════════════════════════════════════════════════
-- Solicitações de Compra — aprovador pela cadeia de gestores do RH
-- Migration: 20261020170000_sc_aprovador_pela_cadeia_do_rh.sql
-- (.scratch/solicitacoes-aprovacao-gestor/issues/01-aprovador-da-sc-pela-cadeia-do-rh.md)
--
-- A SC passa a ser aprovada pelo gestor aprovador de quem pediu, descoberto em
-- colaboradores.gestor_id:
--   • colaboradores.aprova_solicitacao_compra: marca de quem aprova SCs.
--   • requests.approver_id: gestor aprovador, gravado na criação da SC pelo
--     trigger abaixo (o valor mandado pelo client é ignorado, e o client não
--     o altera depois). NULL = sem
--     aprovador na cadeia (quem tem canApproveRequests aprova no lugar).
--   • requests.approved_by_user_id: quem efetivamente aprovou (gestor ou admin
--     no lugar). Preenchido pela decisão (issue 02); requests.approved_by (texto)
--     continua.
--
-- requests_resolver_aprovador(uuid) sobe a cadeia a partir do gestor de quem
-- pediu (nunca do próprio solicitante) até o primeiro colaborador marcado,
-- ativo, com login vinculado e usuário ativo. Mesma regra de
-- resolveRequestApprover (src/utils/requestApprover.ts), que só exibe.
--
-- Só SC: a SM continua sem aprovador. Cálculo único das SCs pending no deploy
-- e marcação inicial de Paulo Vítor, Louise Fontel e Suane Batista De Oliveira
-- (pelo nome, para valer no teste e em produção). Eduarda Fabri e Raquel não
-- aprovam. O recálculo quando o RH muda gestor/marca é a issue 03.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS aprova_solicitacao_compra BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.colaboradores.aprova_solicitacao_compra IS 'Aprova Solicitações de Compra do time abaixo dele na cadeia de gestores (requests.approver_id).';

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS approver_id UUID
    REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by_user_id UUID
    REFERENCES public.user_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.requests.approver_id IS 'Gestor aprovador da SC, resolvido pela cadeia do RH na criação (requests_resolver_aprovador). NULL = sem gestor aprovador no RH; SM sempre NULL.';
COMMENT ON COLUMN public.requests.approved_by_user_id IS 'Usuário que aprovou a SC (o gestor aprovador, ou quem tem canApproveRequests no lugar quando não há aprovador).';

CREATE INDEX IF NOT EXISTS idx_requests_approver_pending
  ON public.requests(approver_id) WHERE status = 'pending';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Resolução. O trigger rh_colaboradores_validar_gestor já barra ciclos; a
-- checagem de visitados aqui só impede um loop infinito se algum escapar.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.requests_resolver_aprovador(p_solicitante uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atual     uuid;
  v_visitados uuid[] := '{}';
  v_c         record;
BEGIN
  IF p_solicitante IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT gestor_id INTO v_atual FROM public.colaboradores WHERE user_profile_id = p_solicitante;

  WHILE v_atual IS NOT NULL AND NOT v_atual = ANY (v_visitados) LOOP
    v_visitados := v_visitados || v_atual;

    SELECT c.gestor_id, c.user_profile_id,
           c.aprova_solicitacao_compra
             AND c.status = 'ativo'
             AND p.id IS NOT NULL
             AND p.is_active = TRUE
             AND p.deleted_at IS NULL
             AND p.disabled_at IS NULL AS utilizavel
      INTO v_c
      FROM public.colaboradores c
      LEFT JOIN public.user_profiles p ON p.id = c.user_profile_id
     WHERE c.id = v_atual;

    IF NOT FOUND THEN
      RETURN NULL;
    END IF;
    IF v_c.utilizavel THEN
      RETURN v_c.user_profile_id;
    END IF;

    v_atual := v_c.gestor_id;
  END LOOP;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.requests_resolver_aprovador(uuid) IS 'Gestor aprovador de uma SC: sobe colaboradores.gestor_id a partir do gestor de quem pediu até o primeiro com aprova_solicitacao_compra, ativo, com login e usuário ativo. NULL sem colaborador, sem gestor ou sem aprovador na cadeia. Espelho: resolveRequestApprover no client.';

REVOKE ALL ON FUNCTION public.requests_resolver_aprovador(uuid) FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Trigger na criação: grava o aprovador das SCs; SM fica sem.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.requests_definir_aprovador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.approver_id := CASE
    WHEN NEW.type = 'SC' THEN public.requests_resolver_aprovador(NEW.requested_by_user_id)
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_requests_definir_aprovador ON public.requests;
CREATE TRIGGER trigger_requests_definir_aprovador
  BEFORE INSERT ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.requests_definir_aprovador();

COMMENT ON FUNCTION public.requests_definir_aprovador() IS 'Na criação da SC, grava requests.approver_id pela cadeia do RH (requests_resolver_aprovador), ignorando o que vier do client. SM fica NULL.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- O client não muda aprovador nem quem aprovou: a policy de UPDATE de requests
-- é aberta (USING true), e sem isto qualquer um se faria approver_id. Só quem
-- roda fora dos papéis do client grava: funções SECURITY DEFINER (decisão da
-- issue 02, recálculo da issue 03 — que precisa ser DEFINER), service_role e
-- migrations. Função sem DEFINER de propósito, para ler o current_user de quem
-- chama.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.requests_proteger_aprovador()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.approver_id IS DISTINCT FROM OLD.approver_id
          OR NEW.approved_by_user_id IS DISTINCT FROM OLD.approved_by_user_id) THEN
    RAISE EXCEPTION 'O aprovador da solicitação é definido pelo sistema e não pode ser alterado.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_requests_proteger_aprovador ON public.requests;
CREATE TRIGGER trigger_requests_proteger_aprovador
  BEFORE UPDATE OF approver_id, approved_by_user_id ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.requests_proteger_aprovador();

COMMENT ON FUNCTION public.requests_proteger_aprovador() IS 'Barra UPDATE de approver_id/approved_by_user_id vindo do client (authenticated/anon). Funções SECURITY DEFINER, service_role e migrations passam.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Marcação inicial dos aprovadores, pelo nome (ids diferem entre teste e
-- produção). Nome ausente só avisa; nome repetido aborta, para não marcar a
-- pessoa errada.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_nome  text;
  v_total integer;
BEGIN
  FOREACH v_nome IN ARRAY ARRAY['Paulo Vítor', 'Louise Fontel', 'Suane Batista De Oliveira'] LOOP
    SELECT count(*) INTO v_total FROM public.colaboradores WHERE btrim(nome) = v_nome;
    IF v_total > 1 THEN
      RAISE EXCEPTION 'Mais de um colaborador chamado "%": marque o aprovador pela tela do RH.', v_nome;
    ELSIF v_total = 0 THEN
      RAISE WARNING 'Colaborador "%" não encontrado: não foi marcado como aprovador de SC.', v_nome;
    ELSE
      UPDATE public.colaboradores SET aprova_solicitacao_compra = TRUE WHERE btrim(nome) = v_nome;
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Cálculo único das SCs pendentes (inclusive REQ868). SCs antigas sem
-- requested_by_user_id ficam sem aprovador; SC que já tem aprovador não muda
-- (reaplicar a migration não reatribui).
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.requests
   SET approver_id = public.requests_resolver_aprovador(requested_by_user_id)
 WHERE type = 'SC' AND status = 'pending' AND approver_id IS NULL;

COMMIT;
