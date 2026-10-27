-- ═══════════════════════════════════════════════════════════════════════════════
-- Pagamentos: o autorizador é o gestor do departamento de quem pede
-- Migration: 20261027150000_departamentos_gestores_pagamentos.sql
--
-- Pedido do usuário (22/Out). Os gestores são os responsáveis do departamento
-- (departamento_responsaveis, 20261020215000), com uma marcação própria para autorizar
-- pagamentos — ser responsável continua valendo para os holerites da equipe, sem que um
-- poder puxe o outro. Decisões dele:
--   1. Autoriza quem é responsável do departamento de quem pede, marcado "autoriza
--      pagamentos", com a permissão "Ser Autorizador de Pagamentos" no cargo.
--   2. Quem pede e é gestor apto do próprio departamento: o pedido já nasce autorizado.
--   3. Só aparecem os gestores aptos. Departamento sem gestor apto: não dá para pedir
--      pagamento (o time responsável manda a lista de gestores de cada departamento).
--   4. Nenhum departamento ativo pode ficar sem gestor apto: o sistema não deixa o último
--      sair, e quem sai com pedidos esperando a autorização dele precisa transferi-los.
--   5. A tela completa de departamentos vira uma aba em Usuários (a mesma do RH).
--
-- O que muda:
--   1. departamento_responsaveis.autoriza_pagamentos (começa desmarcada para todos: os
--      gestores entram pela carga ou pela aba) e a policy de UPDATE dela.
--   2. payment_requests.departamento_id: o departamento do RH de quem pediu, gravado na
--      criação. Preenchido também nos pedidos que hoje aguardam autorização.
--   3. departamento_autorizadores_pagamento(departamento): os gestores aptos.
--   4. payment_request_contexto(): departamento, gestores aptos e se quem está logado é um
--      deles, para o formulário. payment_request_autorizadores() passa à mesma regra.
--   5. payment_request_guard: o autorizador tem de ser gestor apto do departamento do
--      pedido; gestor apto que pede para o próprio departamento autoriza direto.
--   6. Trava "nenhum departamento sem gestor", em todos os caminhos pelos quais um gestor
--      deixa de autorizar (gestor removido ou desmarcado, colaborador desligado, usuário
--      desativado ou removido, troca de cargo, cargo que perde a permissão).
--   7. payment_requests_transferir_autorizacao(): passa os pedidos que aguardam um gestor
--      para outro gestor apto do mesmo departamento.
--   8. departamentos_painel_pagamentos(): situação de cada gestor e pendências, para a aba.
--   9. Modelo de e-mail payment_authorization_transferred.
--
-- Sem usuário logado (SQL Editor, chave de serviço), as travas não checam nada: é a saída
-- de emergência, como em payment_request_guard.
--
-- ATENÇÃO NO DEPLOY: sem nenhum gestor marcado, ninguém consegue pedir pagamento. Aplique
-- junto com a carga dos gestores (ou marque-os na aba antes de liberar o front).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.departamento_responsaveis') IS NULL THEN
    RAISE EXCEPTION 'Aplique antes 20261020215000_rh_departamentos.sql.';
  END IF;
  IF to_regprocedure('public.payment_request_decidir_autorizacao(uuid, boolean, text)') IS NULL THEN
    RAISE EXCEPTION 'Aplique antes 20261020150000_pagamentos_autorizacao.sql.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. MARCAÇÃO "AUTORIZA PAGAMENTOS"
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.departamento_responsaveis
  ADD COLUMN IF NOT EXISTS autoriza_pagamentos BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.departamento_responsaveis.autoriza_pagamentos IS 'O responsável autoriza os pedidos de pagamento de quem está no departamento (com "Ser Autorizador de Pagamentos" no cargo). Independe dos holerites da equipe.';

DROP POLICY IF EXISTS departamento_responsaveis_update ON public.departamento_responsaveis;
CREATE POLICY departamento_responsaveis_update ON public.departamento_responsaveis
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageDepartamentos'))
  WITH CHECK (public.current_user_has_permission('canManageDepartamentos'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. DEPARTAMENTO DO PEDIDO
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS departamento_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.payment_requests.departamento_id IS 'Departamento do RH de quem pediu, na criação (o texto department continua para a lista). Define quem pode autorizar. NULL em pedidos anteriores a 2026-10-22, exceto os que aguardavam autorização.';

CREATE INDEX IF NOT EXISTS idx_payment_requests_aguardando_autorizacao
  ON public.payment_requests(departamento_id, autorizado_por_id) WHERE status = 'awaiting_authorization';

-- Os que hoje aguardam autorização ganham o departamento atual de quem pediu, para a
-- transferência e a trava valerem para eles. Sem mexer em updated_at (os avisos olham ele).
ALTER TABLE public.payment_requests DISABLE TRIGGER trigger_update_payment_requests_updated_at;
UPDATE public.payment_requests pr
   SET departamento_id = c.departamento_id
  FROM public.colaboradores c
 WHERE pr.status = 'awaiting_authorization'
   AND pr.departamento_id IS NULL
   AND c.user_profile_id = pr.solicitante_id;
ALTER TABLE public.payment_requests ENABLE TRIGGER trigger_update_payment_requests_updated_at;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. QUEM AUTORIZA
-- ═══════════════════════════════════════════════════════════════════════════════

-- Departamento do RH de um usuário (pelo colaborador vinculado), como na SC.
CREATE OR REPLACE FUNCTION public.departamento_do_usuario(p_user UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.departamento_id FROM public.colaboradores c WHERE c.user_profile_id = p_user;
$$;

-- Gestores aptos: responsáveis marcados, colaborador ativo, com login, usuário ativo e
-- cargo com a permissão. p_ignorar simula a saída de alguns colaboradores (as travas).
CREATE OR REPLACE FUNCTION public.departamento_autorizadores_pagamento(
  p_departamento UUID,
  p_ignorar UUID[] DEFAULT '{}'
)
RETURNS TABLE (colaborador_id UUID, user_id UUID, nome TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, p.id, p.name
    FROM public.departamento_responsaveis r
    JOIN public.colaboradores c ON c.id = r.colaborador_id
    JOIN public.user_profiles p ON p.id = c.user_profile_id
    JOIN public.custom_roles cr ON cr.id = p.custom_role_id
   WHERE r.departamento_id = p_departamento
     AND r.autoriza_pagamentos
     AND c.status = 'ativo'
     AND p.deleted_at IS NULL
     AND p.disabled_at IS NULL
     AND cr.permissions ? 'canAuthorizePayments'
     AND NOT (c.id = ANY (COALESCE(p_ignorar, '{}')))
   ORDER BY p.name;
$$;

COMMENT ON FUNCTION public.departamento_autorizadores_pagamento(uuid, uuid[]) IS 'Gestores aptos a autorizar os pagamentos do departamento: responsável marcado autoriza_pagamentos, colaborador ativo, com login, usuário ativo e cargo com canAuthorizePayments. p_ignorar tira colaboradores da conta (simula a saída deles).';

REVOKE ALL ON FUNCTION public.departamento_do_usuario(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.departamento_autorizadores_pagamento(uuid, uuid[]) FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. O QUE O FORMULÁRIO MOSTRA
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.payment_request_contexto()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_departamento UUID;
  v_nome TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;
  v_departamento := public.departamento_do_usuario(auth.uid());
  SELECT nome INTO v_nome FROM public.departamentos WHERE id = v_departamento;
  RETURN jsonb_build_object(
    'departamento_id', v_departamento,
    'departamento', v_nome,
    'autorizadores', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', a.user_id, 'name', a.nome) ORDER BY a.nome)
         FROM public.departamento_autorizadores_pagamento(v_departamento) a),
      '[]'::jsonb),
    'sou_autorizador', EXISTS (
      SELECT 1 FROM public.departamento_autorizadores_pagamento(v_departamento) a WHERE a.user_id = auth.uid())
  );
END;
$$;

COMMENT ON FUNCTION public.payment_request_contexto() IS 'Para o formulário de pedido de pagamento: o departamento do RH de quem está logado, os gestores que autorizam os pagamentos dele e se a própria pessoa é um deles (aí o pedido nasce autorizado).';

REVOKE ALL ON FUNCTION public.payment_request_contexto() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payment_request_contexto() TO authenticated;

-- A lista antiga segue a mesma regra (o front em cache ainda chama esta).
CREATE OR REPLACE FUNCTION public.payment_request_autorizadores()
RETURNS TABLE (id UUID, name TEXT, department TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.user_id, a.nome, d.nome
    FROM public.departamentos d
    CROSS JOIN LATERAL public.departamento_autorizadores_pagamento(d.id) a
   WHERE auth.uid() IS NOT NULL
     AND d.id = public.departamento_do_usuario(auth.uid())
   ORDER BY a.nome;
$$;

COMMENT ON FUNCTION public.payment_request_autorizadores() IS 'Gestores aptos do departamento do RH de quem está logado (department = nome do departamento). Substituída no front por payment_request_contexto().';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. A CRIAÇÃO E A TROCA DO AUTORIZADOR
-- ═══════════════════════════════════════════════════════════════════════════════

-- Mesmo corpo de 20261020150000, com a regra do gestor do departamento.
CREATE OR REPLACE FUNCTION public.payment_request_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome TEXT;
  v_departamento TEXT;
BEGIN
  -- Sem usuário logado (SQL Editor, chave de serviço): é a saída de emergência.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.solicitante_id := auth.uid();
    NEW.departamento_id := public.departamento_do_usuario(auth.uid());
    IF NEW.departamento_id IS NULL THEN
      RAISE EXCEPTION 'Você não está em nenhum departamento no RH. Peça ao RH para colocar você no seu departamento antes de pedir um pagamento.'
        USING ERRCODE = '22023';
    END IF;
    SELECT nome INTO v_departamento FROM departamentos WHERE id = NEW.departamento_id;
    IF NOT EXISTS (SELECT 1 FROM public.departamento_autorizadores_pagamento(NEW.departamento_id)) THEN
      RAISE EXCEPTION 'O departamento % não tem gestor que autorize pagamentos. Fale com o RH.', v_departamento
        USING ERRCODE = '22023';
    END IF;
    -- Gestor apto do próprio departamento autoriza direto (decisão do usuário).
    IF EXISTS (SELECT 1 FROM public.departamento_autorizadores_pagamento(NEW.departamento_id) a WHERE a.user_id = auth.uid()) THEN
      NEW.autorizado_por_id := auth.uid();
    ELSIF NEW.autorizado_por_id IS NULL THEN
      RAISE EXCEPTION 'Escolha quem autoriza o pagamento.' USING ERRCODE = '22023';
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.departamento_autorizadores_pagamento(NEW.departamento_id) a WHERE a.user_id = NEW.autorizado_por_id
    ) THEN
      RAISE EXCEPTION 'Essa pessoa não autoriza os pagamentos do departamento %: escolha um dos gestores da lista.', v_departamento
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.solicitante_id IS DISTINCT FROM OLD.solicitante_id THEN
      RAISE EXCEPTION 'O solicitante de um pedido de pagamento não muda.' USING ERRCODE = '42501';
    END IF;
    IF NEW.departamento_id IS DISTINCT FROM OLD.departamento_id THEN
      RAISE EXCEPTION 'O departamento de um pedido de pagamento não muda.' USING ERRCODE = '42501';
    END IF;
    IF NEW.autorizado_por_id IS NOT DISTINCT FROM OLD.autorizado_por_id
       AND NEW.autorizado_por IS NOT DISTINCT FROM OLD.autorizado_por THEN
      RETURN NEW;
    END IF;
    IF NEW.autorizado_por_id IS NULL THEN
      RAISE EXCEPTION 'Escolha quem autoriza o pagamento.' USING ERRCODE = '22023';
    END IF;
    -- Troca de autorizador (transferência): outro gestor apto do departamento do pedido.
    -- Pedido anterior a esta migration sem departamento: basta a permissão, como antes.
    IF NEW.departamento_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.departamento_autorizadores_pagamento(NEW.departamento_id) a WHERE a.user_id = NEW.autorizado_por_id
      ) THEN
        SELECT nome INTO v_departamento FROM departamentos WHERE id = NEW.departamento_id;
        RAISE EXCEPTION 'Essa pessoa não autoriza os pagamentos do departamento %.', v_departamento USING ERRCODE = '42501';
      END IF;
    ELSIF NOT public.user_has_permission(NEW.autorizado_por_id, 'canAuthorizePayments') THEN
      RAISE EXCEPTION 'Essa pessoa não pode autorizar pagamentos.' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT name INTO v_nome FROM user_profiles WHERE id = NEW.autorizado_por_id;
  NEW.autorizado_por := v_nome;

  IF TG_OP = 'INSERT' THEN
    IF NEW.autorizado_por_id = auth.uid() THEN
      NEW.status := 'pending';
      NEW.autorizado_em := now();
    ELSE
      NEW.status := 'awaiting_authorization';
      NEW.autorizado_em := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.payment_request_guard() IS 'Pedido de pagamento, com usuário logado: solicitante e departamento (do RH) são de quem pede e não mudam; o autorizador é um gestor apto do departamento (departamento_autorizadores_pagamento) e o nome vem do perfil; gestor apto que pede para o próprio departamento autoriza direto (pending); senão awaiting_authorization. Sem usuário (SQL), sem checagem.';

DROP TRIGGER IF EXISTS trigger_payment_request_guard ON public.payment_requests;
CREATE TRIGGER trigger_payment_request_guard
  BEFORE INSERT OR UPDATE OF autorizado_por, autorizado_por_id, solicitante_id, departamento_id
  ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.payment_request_guard();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. NENHUM DEPARTAMENTO SEM GESTOR
-- ═══════════════════════════════════════════════════════════════════════════════

-- Barra a saída de gestores (p_colaboradores deixam de autorizar; p_departamento NULL = em
-- todos os departamentos deles) quando um departamento ativo ficaria sem gestor apto, ou
-- quando há pedidos esperando a autorização de quem sai.
CREATE OR REPLACE FUNCTION public.departamentos_validar_saida_autorizadores(
  p_colaboradores UUID[],
  p_departamento UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
  v_pendentes INTEGER;
BEGIN
  FOR v IN
    SELECT d.id AS departamento_id, d.nome AS departamento, d.ativo, a.user_id, a.nome
      FROM public.departamentos d
      CROSS JOIN LATERAL public.departamento_autorizadores_pagamento(d.id) a
     WHERE a.colaborador_id = ANY (p_colaboradores)
       AND (p_departamento IS NULL OR d.id = p_departamento)
  LOOP
    IF v.ativo AND NOT EXISTS (SELECT 1 FROM public.departamento_autorizadores_pagamento(v.departamento_id, p_colaboradores)) THEN
      RAISE EXCEPTION 'O departamento % ficaria sem gestor que autorize pagamentos. Marque outro gestor nele antes.', v.departamento
        USING ERRCODE = '23514';
    END IF;
    SELECT count(*) INTO v_pendentes
      FROM public.payment_requests
     WHERE status = 'awaiting_authorization'
       AND departamento_id = v.departamento_id
       AND autorizado_por_id = v.user_id;
    IF v_pendentes > 0 THEN
      RAISE EXCEPTION '% tem % pedido(s) de pagamento de % esperando a autorização. Transfira-os para outro gestor antes.', v.nome, v_pendentes, v.departamento
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.departamentos_validar_saida_autorizadores(uuid[], uuid) IS 'Erro se a saída desses colaboradores deixar um departamento ativo sem gestor apto, ou deixar pedidos esperando a autorização de um deles. Chamada pelas travas.';

REVOKE ALL ON FUNCTION public.departamentos_validar_saida_autorizadores(uuid[], uuid) FROM PUBLIC, anon, authenticated;

-- Pedidos esperando a autorização de um usuário (inclusive os anteriores sem departamento).
CREATE OR REPLACE FUNCTION public.payment_requests_validar_saida_autorizador(p_user UUID, p_nome TEXT)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pendentes INTEGER;
BEGIN
  SELECT count(*) INTO v_pendentes
    FROM public.payment_requests
   WHERE status = 'awaiting_authorization' AND autorizado_por_id = p_user;
  IF v_pendentes > 0 THEN
    RAISE EXCEPTION '% tem % pedido(s) de pagamento esperando a autorização. Transfira-os para outro gestor na aba Departamentos antes.', p_nome, v_pendentes
      USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.payment_requests_validar_saida_autorizador(uuid, text) FROM PUBLIC, anon, authenticated;

-- ─── Gestor removido ou desmarcado ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.departamento_responsaveis_guardar_autorizadores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (TG_OP = 'DELETE' OR (OLD.autoriza_pagamentos AND NOT NEW.autoriza_pagamentos)) THEN
    PERFORM public.departamentos_validar_saida_autorizadores(ARRAY[OLD.colaborador_id], OLD.departamento_id);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_departamento_responsaveis_guardar_autorizadores ON public.departamento_responsaveis;
CREATE TRIGGER trigger_departamento_responsaveis_guardar_autorizadores
  BEFORE DELETE OR UPDATE OF autoriza_pagamentos ON public.departamento_responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.departamento_responsaveis_guardar_autorizadores();

-- ─── Colaborador desligado ou com outro login ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.colaboradores_guardar_autorizadores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND ((OLD.status = 'ativo' AND NEW.status <> 'ativo')
          OR NEW.user_profile_id IS DISTINCT FROM OLD.user_profile_id) THEN
    PERFORM public.departamentos_validar_saida_autorizadores(ARRAY[OLD.id]);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_colaboradores_guardar_autorizadores ON public.colaboradores;
CREATE TRIGGER trigger_colaboradores_guardar_autorizadores
  BEFORE UPDATE OF status, user_profile_id ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.colaboradores_guardar_autorizadores();

-- ─── Usuário desativado, removido ou com cargo sem a permissão ─────────────────
CREATE OR REPLACE FUNCTION public.cargo_autoriza_pagamentos(p_cargo UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT permissions ? 'canAuthorizePayments' FROM public.custom_roles WHERE id = p_cargo), false);
$$;

REVOKE ALL ON FUNCTION public.cargo_autoriza_pagamentos(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.user_profiles_guardar_autorizadores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_colaboradores UUID[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT ((OLD.disabled_at IS NULL AND NEW.disabled_at IS NOT NULL)
          OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
          OR (public.cargo_autoriza_pagamentos(OLD.custom_role_id)
              AND NOT public.cargo_autoriza_pagamentos(NEW.custom_role_id))) THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(id) INTO v_colaboradores FROM public.colaboradores WHERE user_profile_id = OLD.id;
  IF v_colaboradores IS NOT NULL THEN
    PERFORM public.departamentos_validar_saida_autorizadores(v_colaboradores);
  END IF;
  PERFORM public.payment_requests_validar_saida_autorizador(OLD.id, OLD.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_user_profiles_guardar_autorizadores ON public.user_profiles;
CREATE TRIGGER trigger_user_profiles_guardar_autorizadores
  BEFORE UPDATE OF disabled_at, deleted_at, custom_role_id ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.user_profiles_guardar_autorizadores();

-- ─── Cargo que perde "Ser Autorizador de Pagamentos" ───────────────────────────
CREATE OR REPLACE FUNCTION public.custom_roles_guardar_autorizadores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_colaboradores UUID[];
  v_pessoa RECORD;
BEGIN
  IF auth.uid() IS NULL
     OR NOT (OLD.permissions ? 'canAuthorizePayments')
     OR NEW.permissions ? 'canAuthorizePayments' THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(c.id) INTO v_colaboradores
    FROM public.colaboradores c
    JOIN public.user_profiles p ON p.id = c.user_profile_id
   WHERE p.custom_role_id = OLD.id;
  IF v_colaboradores IS NOT NULL THEN
    PERFORM public.departamentos_validar_saida_autorizadores(v_colaboradores);
  END IF;
  FOR v_pessoa IN SELECT id, name FROM public.user_profiles WHERE custom_role_id = OLD.id LOOP
    PERFORM public.payment_requests_validar_saida_autorizador(v_pessoa.id, v_pessoa.name);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_custom_roles_guardar_autorizadores ON public.custom_roles;
CREATE TRIGGER trigger_custom_roles_guardar_autorizadores
  BEFORE UPDATE OF permissions ON public.custom_roles
  FOR EACH ROW EXECUTE FUNCTION public.custom_roles_guardar_autorizadores();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. TRANSFERIR OS PEDIDOS QUE ESPERAM UM GESTOR
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.payment_requests_transferir_autorizacao(
  p_departamento UUID,
  p_de UUID,
  p_para UUID
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids UUID[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_has_permission('canManageDepartamentos') THEN
    RAISE EXCEPTION 'Sem permissão para transferir autorizações (Gerenciar Departamentos).' USING ERRCODE = '42501';
  END IF;
  IF p_de IS NOT DISTINCT FROM p_para THEN
    RAISE EXCEPTION 'Escolha outro gestor para receber os pedidos.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.departamento_autorizadores_pagamento(p_departamento) a WHERE a.user_id = p_para) THEN
    RAISE EXCEPTION 'Quem recebe precisa ser gestor do departamento e autorizar pagamentos.' USING ERRCODE = '22023';
  END IF;

  -- O trigger payment_request_guard confere o novo autorizador e grava o nome dele.
  WITH movidos AS (
    UPDATE public.payment_requests
       SET autorizado_por_id = p_para
     WHERE status = 'awaiting_authorization'
       AND departamento_id = p_departamento
       AND autorizado_por_id = p_de
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), '{}') INTO v_ids FROM movidos;
  RETURN v_ids;
END;
$$;

COMMENT ON FUNCTION public.payment_requests_transferir_autorizacao(uuid, uuid, uuid) IS 'Passa os pedidos de pagamento do departamento que esperam a autorização de p_de para p_para (gestor apto do mesmo departamento). Com canManageDepartamentos. Devolve os ids, para avisar o novo autorizador.';

REVOKE ALL ON FUNCTION public.payment_requests_transferir_autorizacao(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payment_requests_transferir_autorizacao(uuid, uuid, uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. PAINEL DA ABA DEPARTAMENTOS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Situação de cada gestor e os pedidos esperando autorização, sem abrir user_profiles
-- nem custom_roles além do necessário (nomes e situação, nada de e-mail ou CPF).
CREATE OR REPLACE FUNCTION public.departamentos_painel_pagamentos()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_has_permission('canManageDepartamentos') THEN
    RAISE EXCEPTION 'Sem permissão para ver os gestores dos departamentos (Gerenciar Departamentos).' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'gestores', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'departamento_id', r.departamento_id,
               'colaborador_id', r.colaborador_id,
               'user_id', p.id,
               'autoriza_pagamentos', r.autoriza_pagamentos,
               'situacao', CASE
                 WHEN c.status <> 'ativo' THEN 'desligado'
                 WHEN p.id IS NULL THEN 'sem_login'
                 WHEN p.deleted_at IS NOT NULL OR p.disabled_at IS NOT NULL THEN 'usuario_inativo'
                 WHEN NOT COALESCE(cr.permissions ? 'canAuthorizePayments', false) THEN 'sem_permissao'
                 ELSE 'apto'
               END))
        FROM public.departamento_responsaveis r
        JOIN public.colaboradores c ON c.id = r.colaborador_id
        LEFT JOIN public.user_profiles p ON p.id = c.user_profile_id
        LEFT JOIN public.custom_roles cr ON cr.id = p.custom_role_id), '[]'::jsonb),
    'pendentes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'departamento_id', x.departamento_id,
               'autorizador_id', x.autorizado_por_id,
               'autorizador', x.autorizado_por,
               'quantidade', x.quantidade,
               'valor', x.valor))
        FROM (SELECT departamento_id, autorizado_por_id, max(autorizado_por) AS autorizado_por,
                     count(*) AS quantidade, sum(valor_total) AS valor
                FROM public.payment_requests
               WHERE status = 'awaiting_authorization' AND departamento_id IS NOT NULL
               GROUP BY departamento_id, autorizado_por_id) x), '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.departamentos_painel_pagamentos() IS 'Para a aba Departamentos: situação de cada responsável para autorizar pagamentos (apto, desligado, sem_login, usuario_inativo, sem_permissao) e os pedidos esperando autorização por departamento e autorizador. Com canManageDepartamentos.';

REVOKE ALL ON FUNCTION public.departamentos_painel_pagamentos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.departamentos_painel_pagamentos() TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. MODELO DE E-MAIL DA TRANSFERÊNCIA
-- ═══════════════════════════════════════════════════════════════════════════════
-- Enviado por api/_lib/handlers/notifications-payment-request.ts (evento "transferido") ao
-- gestor que passa a autorizar. Mesmas variáveis dos modelos de 20261020150000.

INSERT INTO public.notification_templates (slug, name, subject_template, body_html)
VALUES (
  'payment_authorization_transferred',
  'Pedido de pagamento transferido para o gestor autorizar',
  '[FlowLAB] Pedido de pagamento {{codigo}} passou para você autorizar',
  '<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Pedido de pagamento passou para você autorizar</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:''Segoe UI'',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f7;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);border-collapse:collapse;">

          <!-- CABEÇALHO -->
          <tr>
            <td align="center" style="background-color:#059669;padding:32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="background-color:rgba(255,255,255,0.15);border-radius:8px;padding:8px 12px;vertical-align:middle;">
                    <span style="font-size:22px;line-height:1;color:#ffffff;">&#128176;</span>
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Flow LAB</span>
                    <br />
                    <span style="font-size:12px;color:rgba(255,255,255,0.85);font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">Pagamentos</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CORPO -->
          <tr>
            <td style="padding:40px 40px 32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
                <tr>
                  <td style="background-color:#ecfdf5;border-radius:6px;padding:6px 14px;">
                    <span style="font-size:12px;font-weight:600;color:#047857;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.5px;">Pedido de pagamento &bull; {{codigo}}</span>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.3;">
                Um pedido de pagamento passou para você autorizar
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;color:#6b7280;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.6;">
                O pedido de <strong>{{solicitante}}</strong> esperava a autorização de outro gestor do departamento e foi transferido para você. Entre no Flow LAB para autorizar ou rejeitar: só depois disso ele segue para a aprovação do Financeiro.
              </p>
              <!-- DETALHES DO PEDIDO -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:28px;border-top:1px solid #f0f0f0;border-bottom:1px solid #f0f0f0;">
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Valor</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:18px;font-weight:700;color:#047857;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{valor}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Fornecedor</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{fornecedor}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Tipo</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{tipo}} &bull; {{forma}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Pagamento em</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{data_pagamento}}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Solicitante</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">{{solicitante}} ({{setor}})</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;width:150px;vertical-align:top;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Descrição</td>
                  <td style="padding:8px 0;vertical-align:top;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;"><span style="white-space:pre-line;">{{descricao}}</span></td>
                </tr>
              </table>
              <!-- BOTÃO -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td align="center" style="border-radius:8px;background-color:#059669;">
                    <a href="{{action_url}}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#059669;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.3px;">
                      Autorizar ou rejeitar &#8594;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0 0;font-size:12px;color:#9ca3af;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br />
                <a href="{{action_url}}" style="color:#047857;text-decoration:none;word-break:break-all;">{{action_url}}</a>
              </p>
            </td>
          </tr>

          <!-- RODAPÉ -->
          <tr>
            <td style="padding:24px 40px 32px 40px;background-color:#fafafa;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:#374151;font-family:''Segoe UI'',Arial,sans-serif;">Flow LAB</p>
              <p style="margin:0 0 12px 0;font-size:12px;color:#9ca3af;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">
                Este é um e-mail automático. Por favor, não responda diretamente a esta mensagem.<br />
                Para decidir, acesse Solicitações &gt; Pagamentos no portal Flow LAB.
              </p>
              <p style="margin:0;font-size:11px;color:#d1d5db;font-family:''Segoe UI'',Arial,sans-serif;">
                &copy; 2026 Flow LAB &bull; Todos os direitos reservados
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>'
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    subject_template = EXCLUDED.subject_template,
    body_html = EXCLUDED.body_html;

COMMIT;
