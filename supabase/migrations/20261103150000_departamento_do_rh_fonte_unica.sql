-- ═══════════════════════════════════════════════════════════════════════════════
-- Departamento: o do RH é a fonte única
-- Migration: 20261103150000_departamento_do_rh_fonte_unica.sql
--
-- Relato de 03/11/2026: ao trocar o departamento de uma pessoa, quem autoriza os pedidos de
-- pagamento dela não mudava. Havia dois campos sem ligação:
--   • user_profiles.department (texto), editado na tela de Usuários: setor do pedido,
--     recorte de leitura por setor e outros módulos;
--   • colaboradores.departamento_id, editado no RH: quem autoriza o pagamento
--     (departamento_do_usuario) e quem aprova a SC (requests_resolver_aprovador).
-- Trocar em Usuários mudava só o texto.
--
-- O que muda (decisão de 03/11: o pedido aguardando segue para o gestor do departamento novo):
--   1. O texto acompanha o RH: ao mudar o departamento do colaborador (ou vincular um login
--      a ele), user_profiles.department recebe o nome do departamento; ao renomear um
--      departamento, todos os usuários dele recebem o nome novo.
--   2. payment_requests_seguir_departamento: os pedidos de quem mudou de departamento que
--      aguardam autorização passam para o departamento novo (e o setor) e para um gestor apto
--      dele (o próprio, se for gestor apto lá; senão o primeiro pela ordem do nome).
--      Departamento novo sem gestor apto: o pedido fica onde está. Pedidos já autorizados
--      não mudam.
--   2b. SCs pendentes de quem mudou de departamento passam para o aprovador do departamento
--      novo (decisão de 03/11), com o e-mail ao aprovador novo.
--   3. payment_request_guard aceita a troca de departamento só nesse caminho (marca
--      flowlab.pedido_segue_departamento da transação); pela API continua proibida.
--   4. RPCs para as telas, que devolvem os pedidos movidos (o front avisa o gestor novo por
--      e-mail, evento "transferido"):
--        colaborador_definir_departamento(colaborador, departamento)  RH
--        usuario_definir_departamento(usuário, nome do departamento)   tela de Usuários
--      Com canManageColaboradores, canManageDepartamentos ou canManageRoles (o que a tela de
--      Usuários já exige para mudar o departamento: perm_protege_perfil).
--
-- Não sincroniza de uma vez quem já está desencontrado: confira antes com a consulta de
-- supabase/scripts/departamento_desencontrado.sql.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.departamento_autorizadores_pagamento(uuid, uuid[])') IS NULL THEN
    RAISE EXCEPTION 'Aplique antes 20261027150000_departamentos_gestores_pagamentos.sql.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. A TRAVA DO DEPARTAMENTO DO PEDIDO
-- ═══════════════════════════════════════════════════════════════════════════════

-- Mesmo corpo de 20261027150000, com a exceção da marca da transação.
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
    -- Só payment_requests_seguir_departamento (quem pediu mudou de departamento no RH) troca
    -- o departamento, com a marca da transação; pela API, nunca.
    IF NEW.departamento_id IS DISTINCT FROM OLD.departamento_id
       AND current_setting('flowlab.pedido_segue_departamento', true) IS DISTINCT FROM 'on' THEN
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

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. PEDIDOS AGUARDANDO SEGUEM QUEM MUDOU DE DEPARTAMENTO
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.payment_requests_seguir_departamento(p_user UUID, p_departamento UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autorizador UUID;
  v_nome TEXT;
  v_ids UUID[];
BEGIN
  IF p_user IS NULL OR p_departamento IS NULL THEN
    RETURN '{}';
  END IF;

  -- O próprio, se for gestor apto do departamento novo; senão o primeiro gestor apto.
  SELECT a.user_id, a.nome INTO v_autorizador, v_nome
    FROM public.departamento_autorizadores_pagamento(p_departamento) a
   ORDER BY (a.user_id = p_user) DESC, a.nome
   LIMIT 1;
  IF v_autorizador IS NULL THEN
    RETURN '{}';
  END IF;

  -- O nome vai junto: sem usuário logado (SQL Editor), o payment_request_guard não confere
  -- nem copia o nome; com usuário, ele confere o gestor e grava o nome do perfil.
  PERFORM set_config('flowlab.pedido_segue_departamento', 'on', true);
  -- O setor (texto do pedido: card, filtro e leitura por setor) acompanha o departamento.
  WITH movidos AS (
    UPDATE public.payment_requests
       SET departamento_id = p_departamento,
           department = (SELECT d.nome FROM public.departamentos d WHERE d.id = p_departamento),
           autorizado_por_id = v_autorizador,
           autorizado_por = v_nome
     WHERE solicitante_id = p_user
       AND status = 'awaiting_authorization'
       AND departamento_id IS DISTINCT FROM p_departamento
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), '{}') INTO v_ids FROM movidos;
  PERFORM set_config('flowlab.pedido_segue_departamento', 'off', true);
  RETURN v_ids;
END;
$$;

COMMENT ON FUNCTION public.payment_requests_seguir_departamento(uuid, uuid) IS 'Passa os pedidos de pagamento de p_user que aguardam autorização para o departamento p_departamento e um gestor apto dele (o próprio, se for gestor lá). Sem gestor apto, nada muda. Devolve os ids movidos.';

REVOKE ALL ON FUNCTION public.payment_requests_seguir_departamento(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. O TEXTO DO DEPARTAMENTO ACOMPANHA O RH
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.colaboradores_seguir_departamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids UUID[];
BEGIN
  IF NEW.user_profile_id IS NULL OR NEW.departamento_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.user_profiles p
     SET department = d.nome
    FROM public.departamentos d
   WHERE d.id = NEW.departamento_id
     AND p.id = NEW.user_profile_id
     AND p.department IS DISTINCT FROM d.nome;

  IF TG_OP = 'UPDATE' AND NEW.departamento_id IS DISTINCT FROM OLD.departamento_id THEN
    v_ids := public.payment_requests_seguir_departamento(NEW.user_profile_id, NEW.departamento_id);
    -- Para as RPCs abaixo devolverem à tela os pedidos movidos nesta transação.
    IF cardinality(v_ids) > 0 THEN
      PERFORM set_config(
        'flowlab.pedidos_movidos',
        concat_ws(',', nullif(current_setting('flowlab.pedidos_movidos', true), ''), array_to_string(v_ids, ',')),
        true);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.colaboradores_seguir_departamento() IS 'Colaborador com login mudou de departamento (ou ganhou login): user_profiles.department recebe o nome do departamento do RH, e os pedidos de pagamento dele que aguardam autorização seguem para o departamento novo.';

REVOKE ALL ON FUNCTION public.colaboradores_seguir_departamento() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_colaboradores_seguir_departamento ON public.colaboradores;
CREATE TRIGGER trigger_colaboradores_seguir_departamento
  AFTER INSERT OR UPDATE OF departamento_id, user_profile_id ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.colaboradores_seguir_departamento();

CREATE OR REPLACE FUNCTION public.departamentos_renomear_usuarios()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.nome IS DISTINCT FROM OLD.nome THEN
    UPDATE public.user_profiles p
       SET department = NEW.nome
      FROM public.colaboradores c
     WHERE c.departamento_id = NEW.id
       AND c.user_profile_id = p.id
       AND p.department IS DISTINCT FROM NEW.nome;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.departamentos_renomear_usuarios() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_departamentos_renomear_usuarios ON public.departamentos;
CREATE TRIGGER trigger_departamentos_renomear_usuarios
  AFTER UPDATE OF nome ON public.departamentos
  FOR EACH ROW EXECUTE FUNCTION public.departamentos_renomear_usuarios();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. SCs PENDENTES SEGUEM QUEM MUDOU DE DEPARTAMENTO
-- ═══════════════════════════════════════════════════════════════════════════════

-- Corpo de 20261020234000 com a decisão de 03/11: ao MUDAR de departamento, todas as SCs
-- pending da pessoa passam para o aprovador do departamento novo, pela mesma regra da criação
-- (requests_resolver_aprovador; sem aprovador lá, ou se a própria pessoa é o aprovador, a SC
-- fica sem aprovador e quem tem canApproveRequests decide). Ao ENTRAR num departamento
-- (cadastro novo), continua só preenchendo as SCs sem aprovador. A SC mantém o seu
-- department (texto): ele diz para onde vai o que se compra, não quem aprova.
-- O e-mail ao aprovador novo sai sozinho: requests_reabrir_aviso_aprovador (20261020235000)
-- devolve a SC à fila do aviso quando approver_id muda.
CREATE OR REPLACE FUNCTION public.requests_recalcular_aprovador_colaborador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aprovador uuid;
BEGIN
  IF NEW.user_profile_id IS NULL OR NEW.departamento_id IS NULL
     OR (TG_OP = 'UPDATE' AND NEW.departamento_id IS NOT DISTINCT FROM OLD.departamento_id) THEN
    RETURN NULL;
  END IF;

  v_aprovador := public.requests_resolver_aprovador(NEW.user_profile_id);

  IF TG_OP = 'INSERT' THEN
    IF v_aprovador IS NOT NULL THEN
      UPDATE public.requests
         SET approver_id = v_aprovador
       WHERE requested_by_user_id = NEW.user_profile_id
         AND type = 'SC'
         AND status = 'pending'
         AND approver_id IS NULL;
    END IF;
  ELSE
    UPDATE public.requests
       SET approver_id = v_aprovador
     WHERE requested_by_user_id = NEW.user_profile_id
       AND type = 'SC'
       AND status = 'pending'
       AND approver_id IS DISTINCT FROM v_aprovador;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.requests_recalcular_aprovador_colaborador() IS 'Colaborador mudou de departamento: as SCs pending dele passam para o aprovador do departamento novo (requests_resolver_aprovador; NULL = quem tem canApproveRequests decide). Entrou num departamento: grava o aprovador só nas SCs sem aprovador.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. RPCs DAS TELAS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.departamento_pode_trocar()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (public.current_user_has_permission('canManageColaboradores')
          OR public.current_user_has_permission('canManageDepartamentos')
          OR public.current_user_has_permission('canManageRoles'));
$$;

-- RH: troca o departamento do colaborador e devolve os pedidos movidos.
CREATE OR REPLACE FUNCTION public.colaborador_definir_departamento(p_colaborador UUID, p_departamento UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.departamento_pode_trocar() THEN
    RAISE EXCEPTION 'Sem permissão para mudar o departamento (Gerenciar Colaboradores, Departamentos ou Cargos).' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('flowlab.pedidos_movidos', '', true);
  -- colaboradores_validar_departamento confere se o departamento existe e está ativo.
  UPDATE public.colaboradores SET departamento_id = p_departamento WHERE id = p_colaborador;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador não encontrado.' USING ERRCODE = '22023';
  END IF;
  RETURN COALESCE(string_to_array(nullif(current_setting('flowlab.pedidos_movidos', true), ''), ',')::uuid[], '{}');
END;
$$;

COMMENT ON FUNCTION public.colaborador_definir_departamento(uuid, uuid) IS 'Muda o departamento do colaborador (o texto do usuário e os pedidos aguardando seguem pelo trigger colaboradores_seguir_departamento). Devolve os ids dos pedidos de pagamento movidos, para avisar o gestor novo.';

REVOKE ALL ON FUNCTION public.colaborador_definir_departamento(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.colaborador_definir_departamento(uuid, uuid) TO authenticated;

-- Tela de Usuários: o departamento escolhido (pelo nome) vai para o colaborador do usuário.
CREATE OR REPLACE FUNCTION public.usuario_definir_departamento(p_user UUID, p_departamento TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_colaborador UUID;
  v_departamento UUID;
  v_movidos UUID[];
BEGIN
  IF NOT public.departamento_pode_trocar() THEN
    RAISE EXCEPTION 'Sem permissão para mudar o departamento (Gerenciar Colaboradores, Departamentos ou Cargos).' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_colaborador FROM public.colaboradores WHERE user_profile_id = p_user;
  IF v_colaborador IS NULL THEN
    RETURN jsonb_build_object('situacao', 'sem_colaborador', 'movidos', '[]'::jsonb);
  END IF;
  SELECT id INTO v_departamento
    FROM public.departamentos
   WHERE ativo AND lower(btrim(nome)) = lower(btrim(p_departamento));
  IF v_departamento IS NULL THEN
    RETURN jsonb_build_object('situacao', 'sem_departamento', 'movidos', '[]'::jsonb);
  END IF;
  v_movidos := public.colaborador_definir_departamento(v_colaborador, v_departamento);
  RETURN jsonb_build_object('situacao', 'ok', 'movidos', to_jsonb(v_movidos));
END;
$$;

COMMENT ON FUNCTION public.usuario_definir_departamento(uuid, text) IS 'Tela de Usuários: põe o colaborador do usuário no departamento do RH com esse nome. situacao: ok, sem_colaborador (usuário sem colaborador vinculado) ou sem_departamento (não há departamento ativo com o nome). movidos: pedidos de pagamento que seguiram para o departamento novo.';

REVOKE ALL ON FUNCTION public.usuario_definir_departamento(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usuario_definir_departamento(uuid, text) TO authenticated;

COMMIT;
