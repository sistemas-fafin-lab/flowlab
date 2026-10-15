-- ═══════════════════════════════════════════════════════════════════════════════
-- EVA — permissões por pessoa, sem precisar de cargo
-- Migration: 20261015160000_eva_papeis_por_pessoa.sql
-- (.scratch/agente-ti/issues/22-permissoes-por-pessoa.md; plano D33)
--
-- Pedido do usuário (15/Out): controlar as três permissões da EVA (configurar, gestor, aprovar;
-- D31) pessoa a pessoa, sem criar cargos só para isso.
--
-- Regra, para as três chaves da EVA e só para elas:
--   admin                         tem as três, sempre;
--   pessoa com linha nesta tabela vale a linha, no lugar do cargo (inclusive para tirar);
--   sem linha                     vale o cargo, como antes.
-- Removido ou desativado: nenhuma, como no resto do FlowLab.
--
-- Gravar é só pelas RPCs ti_agente_definir_papeis e ti_agente_voltar_ao_cargo, de quem configura.
-- Elas não deixam ninguém tirar a própria permissão de configurar (ficaria fora da tela).
--
-- As policies e RPCs da EVA trocam current_user_has_permission('can…AgenteTI') por
-- ti_agente_pode('can…AgenteTI'), que aplica a regra acima. canManageIT continua pelo cargo.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.ti_agente_tem_permissao(uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Aplique 20261015120000_eva_papeis.sql antes desta migration.';
  END IF;
END $$;

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. TABELA
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ti_agente_papeis (
  user_id     uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  configura   boolean NOT NULL DEFAULT false,
  gestor      boolean NOT NULL DEFAULT false,
  aprova      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.ti_agente_papeis IS 'Permissões da EVA definidas pessoa a pessoa (D33). Com linha, vale a linha no lugar do cargo, só para canConfigureAgenteTI, canManageAgenteTI e canApproveAgenteTI; sem linha, vale o cargo. Admin tem as três sempre. Grava só pelas RPCs ti_agente_definir_papeis e ti_agente_voltar_ao_cargo.';
COMMENT ON COLUMN public.ti_agente_papeis.configura IS 'canConfigureAgenteTI: abas Membros, Permissões e Configurações.';
COMMENT ON COLUMN public.ti_agente_papeis.gestor IS 'canManageAgenteTI: cobrar a equipe, avisar o grupo e as pessoas, a fila do WhatsApp.';
COMMENT ON COLUMN public.ti_agente_papeis.aprova IS 'canApproveAgenteTI: aprovar e rejeitar sugestões, na tela e pelo WhatsApp.';
COMMENT ON COLUMN public.ti_agente_papeis.updated_by IS 'Quem definiu por último.';

DROP TRIGGER IF EXISTS ti_agente_papeis_set_updated ON public.ti_agente_papeis;
CREATE TRIGGER ti_agente_papeis_set_updated
  BEFORE UPDATE ON public.ti_agente_papeis
  FOR EACH ROW EXECUTE FUNCTION public.ti_agente_set_updated();

ALTER TABLE public.ti_agente_papeis ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. A REGRA
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ti_agente_tem_permissao(p_user uuid, p_chave text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user IS NOT NULL AND p_chave IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.user_profiles p
      LEFT JOIN public.custom_roles cr ON cr.id = p.custom_role_id
      LEFT JOIN public.ti_agente_papeis tp ON tp.user_id = p.id
     WHERE p.id = p_user
       AND p.deleted_at IS NULL
       AND p.disabled_at IS NULL
       AND (
         p.role = 'admin'
         OR CASE
              WHEN tp.user_id IS NOT NULL AND p_chave = 'canConfigureAgenteTI' THEN tp.configura
              WHEN tp.user_id IS NOT NULL AND p_chave = 'canManageAgenteTI' THEN tp.gestor
              WHEN tp.user_id IS NOT NULL AND p_chave = 'canApproveAgenteTI' THEN tp.aprova
              ELSE COALESCE(cr.permissions @> to_jsonb(ARRAY[p_chave]), false)
            END
       )
  );
$$;

COMMENT ON FUNCTION public.ti_agente_tem_permissao(uuid, text) IS 'A permissão de um usuário dado: admin; nas três chaves da EVA, a linha de ti_agente_papeis quando existe (D33); senão, o cargo. Removido ou desativado, não. Usada nos comandos pelo WhatsApp, onde não há sessão (D29, D31).';

-- A mesma regra para quem está logado: é o que as policies e as RPCs da EVA usam.
CREATE OR REPLACE FUNCTION public.ti_agente_pode(p_chave text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ti_agente_tem_permissao(auth.uid(), p_chave);
$$;

COMMENT ON FUNCTION public.ti_agente_pode(text) IS 'ti_agente_tem_permissao para o usuário da sessão. Nas policies e RPCs da EVA, no lugar de current_user_has_permission para as chaves can…AgenteTI (D33).';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. RLS
-- ═══════════════════════════════════════════════════════════════════════════════

-- A própria linha (o front monta as permissões da sessão com ela) ou todas, para quem configura.
DROP POLICY IF EXISTS ti_agente_papeis_select ON public.ti_agente_papeis;
CREATE POLICY ti_agente_papeis_select ON public.ti_agente_papeis
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (SELECT public.ti_agente_pode('canConfigureAgenteTI')));

DROP POLICY IF EXISTS ti_agente_config_select ON public.ti_agente_config;
CREATE POLICY ti_agente_config_select ON public.ti_agente_config
  FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_has_permission('canManageIT'))
    OR (SELECT public.ti_agente_pode('canApproveAgenteTI'))
    OR (SELECT public.ti_agente_pode('canConfigureAgenteTI'))
    OR (SELECT public.ti_agente_pode('canManageAgenteTI'))
  );

DROP POLICY IF EXISTS ti_agente_config_update ON public.ti_agente_config;
CREATE POLICY ti_agente_config_update ON public.ti_agente_config
  FOR UPDATE TO authenticated
  USING ((SELECT public.ti_agente_pode('canConfigureAgenteTI')))
  WITH CHECK ((SELECT public.ti_agente_pode('canConfigureAgenteTI')));

DROP POLICY IF EXISTS ti_agente_membros_select ON public.ti_agente_membros;
CREATE POLICY ti_agente_membros_select ON public.ti_agente_membros
  FOR SELECT TO authenticated
  USING ((SELECT public.ti_agente_pode('canConfigureAgenteTI')) OR (SELECT public.ti_agente_pode('canManageAgenteTI')));

DROP POLICY IF EXISTS ti_agente_membros_insert ON public.ti_agente_membros;
CREATE POLICY ti_agente_membros_insert ON public.ti_agente_membros
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.ti_agente_pode('canConfigureAgenteTI')));

DROP POLICY IF EXISTS ti_agente_membros_update ON public.ti_agente_membros;
CREATE POLICY ti_agente_membros_update ON public.ti_agente_membros
  FOR UPDATE TO authenticated
  USING ((SELECT public.ti_agente_pode('canConfigureAgenteTI')))
  WITH CHECK ((SELECT public.ti_agente_pode('canConfigureAgenteTI')));

DROP POLICY IF EXISTS ti_agente_reunioes_select ON public.ti_agente_reunioes;
CREATE POLICY ti_agente_reunioes_select ON public.ti_agente_reunioes
  FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_has_permission('canManageIT'))
    OR (SELECT public.ti_agente_pode('canApproveAgenteTI'))
    OR (SELECT public.ti_agente_pode('canConfigureAgenteTI'))
  );

DROP POLICY IF EXISTS ti_agente_sugestoes_select ON public.ti_agente_sugestoes;
CREATE POLICY ti_agente_sugestoes_select ON public.ti_agente_sugestoes
  FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_has_permission('canManageIT'))
    OR (SELECT public.ti_agente_pode('canApproveAgenteTI'))
  );

DROP POLICY IF EXISTS ti_agente_mensagens_select ON public.ti_agente_mensagens;
CREATE POLICY ti_agente_mensagens_select ON public.ti_agente_mensagens
  FOR SELECT TO authenticated
  USING ((SELECT public.ti_agente_pode('canManageAgenteTI')) OR (SELECT public.ti_agente_pode('canConfigureAgenteTI')));

DROP POLICY IF EXISTS ti_agente_chamadas_ia_select ON public.ti_agente_chamadas_ia;
CREATE POLICY ti_agente_chamadas_ia_select ON public.ti_agente_chamadas_ia
  FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_has_permission('canManageIT'))
    OR (SELECT public.ti_agente_pode('canApproveAgenteTI'))
    OR (SELECT public.ti_agente_pode('canConfigureAgenteTI'))
  );

DROP POLICY IF EXISTS ti_agente_comandos_select ON public.ti_agente_comandos;
CREATE POLICY ti_agente_comandos_select ON public.ti_agente_comandos
  FOR SELECT TO authenticated
  USING ((SELECT public.ti_agente_pode('canManageAgenteTI')) OR (SELECT public.ti_agente_pode('canApproveAgenteTI')));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. RPCs DA TELA — mesmos corpos, com ti_agente_pode
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ti_agente_aprovar_sugestao(p_id uuid, p_proposta jsonb DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.ti_agente_pode('canApproveAgenteTI') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar sugestões da EVA.' USING ERRCODE = '42501';
  END IF;
  RETURN public.ti_agente_aprovar_sugestao_como(p_id, p_proposta, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.ti_agente_rejeitar_sugestao(p_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.ti_agente_pode('canApproveAgenteTI') THEN
    RAISE EXCEPTION 'Sem permissão para rejeitar sugestões da EVA.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.ti_agente_rejeitar_sugestao_como(p_id, p_motivo, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.ti_agente_propor_sugestao(
  p_tipo text,
  p_card_id uuid,
  p_proposta jsonb,
  p_trecho text,
  p_origem text,
  p_aprovar boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT (public.current_user_has_permission('canManageIT') OR public.ti_agente_pode('canApproveAgenteTI')) THEN
    RAISE EXCEPTION 'Sem permissão para propor ações da EVA.' USING ERRCODE = '42501';
  END IF;
  IF p_aprovar AND NOT public.ti_agente_pode('canApproveAgenteTI') THEN
    RAISE EXCEPTION 'Só gestores aprovam e executam ações da EVA.' USING ERRCODE = '42501';
  END IF;
  -- Reunião e WhatsApp nascem no servidor (service role); por aqui só comentário e chat.
  IF p_origem NOT IN ('comentario', 'chat') THEN
    RAISE EXCEPTION 'Origem inválida para proposta: %.', p_origem USING ERRCODE = '22023';
  END IF;
  IF p_tipo NOT IN ('criar_card', 'atualizar_card', 'comentar_card') THEN
    RAISE EXCEPTION 'Tipo de proposta inválido: %.', p_tipo USING ERRCODE = '22023';
  END IF;
  IF p_tipo <> 'criar_card' AND NOT EXISTS (SELECT 1 FROM public.it_requests WHERE id = p_card_id) THEN
    RAISE EXCEPTION 'O card da proposta não existe.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.ti_agente_sugestoes (origem, proposta_por, tipo, card_id, proposta, trecho, confianca)
  VALUES (p_origem, auth.uid(), p_tipo, CASE WHEN p_tipo = 'criar_card' THEN NULL ELSE p_card_id END,
          COALESCE(p_proposta, '{}'::jsonb), COALESCE(NULLIF(btrim(p_trecho), ''), 'Proposta da EVA'), 'alta')
  RETURNING id INTO v_id;

  IF p_aprovar THEN
    PERFORM public.ti_agente_aprovar_sugestao(v_id, NULL);
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ti_agente_cobrancas_hoje()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.current_user_has_permission('canManageIT') OR public.ti_agente_pode('canManageAgenteTI') OR public.ti_agente_pode('canApproveAgenteTI')) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT count(*)::integer
      FROM public.ti_agente_mensagens
     WHERE direcao = 'saida'
       AND tipo IN ('cobranca', 'cobranca_manual')
       AND status IN ('enviada', 'entregue', 'lida')
       AND (enviada_em AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. DEFINIR E VOLTAR AO CARGO (aba Permissões)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ti_agente_definir_papeis(p_user uuid, p_configura boolean, p_gestor boolean, p_aprova boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role       text;
  v_deleted_at timestamptz;
BEGIN
  IF NOT public.ti_agente_pode('canConfigureAgenteTI') THEN
    RAISE EXCEPTION 'Só quem configura a EVA muda as permissões dela.' USING ERRCODE = '42501';
  END IF;
  IF p_configura IS NULL OR p_gestor IS NULL OR p_aprova IS NULL THEN
    RAISE EXCEPTION 'Informe as três permissões.' USING ERRCODE = '22023';
  END IF;

  SELECT role, deleted_at INTO v_role, v_deleted_at FROM public.user_profiles WHERE id = p_user;
  IF NOT FOUND OR v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_role = 'admin' THEN
    RAISE EXCEPTION 'O administrador tem as três permissões da EVA, sempre.' USING ERRCODE = '22023';
  END IF;
  IF p_user = auth.uid() AND NOT p_configura THEN
    RAISE EXCEPTION 'Você não pode tirar a sua própria permissão de configurar a EVA.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ti_agente_papeis (user_id, configura, gestor, aprova, updated_by)
  VALUES (p_user, p_configura, p_gestor, p_aprova, auth.uid())
  ON CONFLICT (user_id) DO UPDATE
    SET configura = EXCLUDED.configura, gestor = EXCLUDED.gestor, aprova = EXCLUDED.aprova;
END;
$$;

COMMENT ON FUNCTION public.ti_agente_definir_papeis(uuid, boolean, boolean, boolean) IS 'Define as três permissões da EVA de uma pessoa, no lugar do cargo (D33). Só quem configura; não vale para admin nem para tirar a própria permissão de configurar.';

CREATE OR REPLACE FUNCTION public.ti_agente_voltar_ao_cargo(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.ti_agente_pode('canConfigureAgenteTI') THEN
    RAISE EXCEPTION 'Só quem configura a EVA muda as permissões dela.' USING ERRCODE = '42501';
  END IF;
  -- Voltar ao cargo não pode tirar de quem pede o acesso a esta tela.
  IF p_user = auth.uid() AND NOT EXISTS (
    SELECT 1
      FROM public.user_profiles p
      LEFT JOIN public.custom_roles cr ON cr.id = p.custom_role_id
     WHERE p.id = p_user
       AND (p.role = 'admin' OR cr.permissions @> to_jsonb(ARRAY['canConfigureAgenteTI']))
  ) THEN
    RAISE EXCEPTION 'Pelo seu cargo você não configura a EVA: voltar ao cargo tiraria o seu acesso a esta tela.' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.ti_agente_papeis WHERE user_id = p_user;
END;
$$;

COMMENT ON FUNCTION public.ti_agente_voltar_ao_cargo(uuid) IS 'Apaga as permissões da EVA definidas para a pessoa: ela volta a seguir o cargo (D33). Só quem configura.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. ACESSO ÀS FUNÇÕES
-- ═══════════════════════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public.ti_agente_pode(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ti_agente_definir_papeis(uuid, boolean, boolean, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ti_agente_voltar_ao_cargo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ti_agente_pode(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ti_agente_definir_papeis(uuid, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ti_agente_voltar_ao_cargo(uuid) TO authenticated;

-- ti_agente_tem_permissao continua só do servidor: o cliente usa ti_agente_pode, que só responde por ele mesmo.
REVOKE ALL ON FUNCTION public.ti_agente_tem_permissao(uuid, text) FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.ti_agente_tem_permissao(uuid, text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.ti_agente_pode(text) TO service_role;
  END IF;
END $$;

-- O cliente lê a tabela pela policy; grava só pelas RPCs acima.
GRANT SELECT ON public.ti_agente_papeis TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.ti_agente_papeis TO service_role;
  END IF;
END $$;

COMMIT;
