-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — Solicitação de alteração de dados pessoais (openspec/changes/rh-solicitacao-alteracao-dados)
--
-- O colaborador propõe alterações nos próprios dados pessoais pelo Meu perfil;
-- o RH (canManageColaboradores) aprova ou recusa. Toda escrita passa pelas RPCs
-- abaixo (SECURITY DEFINER, padrão de payment_request_decidir_autorizacao):
-- a tabela não tem policy de INSERT/UPDATE/DELETE.
--
-- alteracoes = [{ "campo": <coluna de colaborador_dados_pessoais>, "de": <valor>, "para": <valor> }]
-- Valores como texto JSON (data em "YYYY-MM-DD") ou null. "de" é sempre recalculado no servidor.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Tabela ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.colaborador_solicitacoes_alteracao (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id      uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  solicitado_por      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  alteracoes          jsonb NOT NULL CHECK (jsonb_typeof(alteracoes) = 'array' AND jsonb_array_length(alteracoes) > 0),
  status              text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'recusada', 'cancelada')),
  motivo_recusa       text,
  decidido_por        uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  decidido_em         timestamptz,
  -- Quando o colaborador dispensou o aviso de resultado (aprovada/recusada).
  resultado_visto_em  timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.colaborador_solicitacoes_alteracao IS
  'Solicitações de alteração de dados pessoais feitas pelo colaborador e decididas pelo RH. Também é o histórico das alterações feitas por solicitação. Escrita só pelas RPCs rh_*.';

-- No máximo uma pendente por colaborador.
CREATE UNIQUE INDEX IF NOT EXISTS colaborador_solicitacoes_alteracao_uma_pendente
  ON public.colaborador_solicitacoes_alteracao(colaborador_id) WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS colaborador_solicitacoes_alteracao_colaborador_idx
  ON public.colaborador_solicitacoes_alteracao(colaborador_id, created_at DESC);

ALTER TABLE public.colaborador_solicitacoes_alteracao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS colaborador_solicitacoes_alteracao_select ON public.colaborador_solicitacoes_alteracao;
CREATE POLICY colaborador_solicitacoes_alteracao_select ON public.colaborador_solicitacoes_alteracao
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewColaboradores')
    OR public.current_user_has_permission('canManageColaboradores')
    OR colaborador_id IN (SELECT c.id FROM public.colaboradores c WHERE c.user_profile_id = auth.uid())
  );

-- ─── 2. Validação de um valor de dados pessoais ────────────────────────────────
-- Espelha os CHECKs de colaborador_dados_pessoais (20261030120000) para recusar
-- a solicitação no envio, e não só na aprovação.

CREATE OR REPLACE FUNCTION public.rh_dados_pessoais_valor_valido(p_campo text, p_valor text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_valor IS NULL THEN
    RETURN true;
  END IF;
  CASE p_campo
    WHEN 'nacionalidade' THEN RETURN p_valor IN ('brasileira', 'brasileira_naturalizada', 'estrangeira');
    WHEN 'uf_nascimento' THEN RETURN p_valor IN (
      'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
      'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO');
    WHEN 'cor_raca' THEN RETURN p_valor IN ('branca', 'preta', 'parda', 'amarela', 'indigena', 'nao_declarar');
    WHEN 'genero' THEN RETURN p_valor IN ('masculino', 'feminino', 'nao_declarar');
    WHEN 'estado_civil' THEN RETURN p_valor IN ('solteiro', 'casado', 'uniao_estavel', 'divorciado', 'separado', 'viuvo');
    WHEN 'data_nascimento' THEN
      -- A comparação com a data de hoje fica na RPC (esta função é IMMUTABLE).
      RETURN p_valor ~ '^\d{4}-\d{2}-\d{2}$';
    WHEN 'cidade_nascimento', 'nome_mae', 'nome_pai' THEN RETURN char_length(p_valor) <= 200;
    ELSE RETURN false;
  END CASE;
END;
$$;

-- ─── 3. Solicitar ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rh_solicitar_alteracao(p_alteracoes jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campos constant text[] := ARRAY[
    'nacionalidade', 'uf_nascimento', 'cidade_nascimento', 'cor_raca', 'genero',
    'estado_civil', 'data_nascimento', 'nome_mae', 'nome_pai'];
  v_colaborador_id uuid;
  v_colaborador_nome text;
  v_atual jsonb;
  v_item jsonb;
  v_campo text;
  v_para text;
  v_de text;
  v_alteracoes jsonb := '[]'::jsonb;
  v_vistos text[] := '{}';
  v_id uuid;
BEGIN
  SELECT c.id, c.nome INTO v_colaborador_id, v_colaborador_nome
    FROM colaboradores c WHERE c.user_profile_id = auth.uid();
  IF v_colaborador_id IS NULL THEN
    RAISE EXCEPTION 'Seu usuário não está vinculado a um cadastro de colaborador.';
  END IF;

  IF p_alteracoes IS NULL OR jsonb_typeof(p_alteracoes) <> 'array' THEN
    RAISE EXCEPTION 'Formato de alterações inválido.';
  END IF;

  SELECT to_jsonb(dp) INTO v_atual FROM colaborador_dados_pessoais dp WHERE dp.colaborador_id = v_colaborador_id;
  v_atual := COALESCE(v_atual, '{}'::jsonb);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_alteracoes) LOOP
    v_campo := v_item->>'campo';
    -- Um campo fora da lista (nome, CPF, ...) recusa a solicitação inteira.
    IF v_campo IS NULL OR NOT (v_campo = ANY (v_campos)) THEN
      RAISE EXCEPTION 'Campo não permitido na solicitação: %', COALESCE(v_campo, '(vazio)');
    END IF;
    IF v_campo = ANY (v_vistos) THEN
      RAISE EXCEPTION 'Campo repetido na solicitação: %', v_campo;
    END IF;
    v_vistos := v_vistos || v_campo;

    v_para := nullif(btrim(v_item->>'para'), '');
    IF NOT public.rh_dados_pessoais_valor_valido(v_campo, v_para) THEN
      RAISE EXCEPTION 'Valor inválido para o campo %.', v_campo;
    END IF;
    IF v_campo = 'data_nascimento' AND v_para IS NOT NULL THEN
      BEGIN
        IF v_para::date > current_date THEN
          RAISE EXCEPTION 'A data de nascimento não pode ser uma data futura.';
        END IF;
      EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
        RAISE EXCEPTION 'Data de nascimento inválida.';
      END;
    END IF;

    v_de := v_atual->>v_campo;
    -- Sem diferença real, o item é descartado.
    IF v_de IS DISTINCT FROM v_para THEN
      v_alteracoes := v_alteracoes || jsonb_build_object('campo', v_campo, 'de', v_de, 'para', v_para);
    END IF;
  END LOOP;

  IF jsonb_array_length(v_alteracoes) = 0 THEN
    RAISE EXCEPTION 'Nenhuma alteração para enviar.';
  END IF;

  BEGIN
    INSERT INTO colaborador_solicitacoes_alteracao (colaborador_id, solicitado_por, alteracoes)
    VALUES (v_colaborador_id, auth.uid(), v_alteracoes)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Você já tem uma solicitação em análise pelo RH.';
  END;

  -- Avisa o RH (cargos com canManageColaboradores), menos quem solicitou.
  INSERT INTO user_notifications (user_id, title, content, module, type, link)
  SELECT p.id,
         'Solicitação de alteração de ' || v_colaborador_nome,
         jsonb_array_length(v_alteracoes) || CASE WHEN jsonb_array_length(v_alteracoes) = 1
           THEN ' campo de dados pessoais aguardando análise.'
           ELSE ' campos de dados pessoais aguardando análise.' END,
         'HR', 'info', '/rh/colaboradores?colaborador=' || v_colaborador_id
    FROM user_profiles p
    JOIN custom_roles cr ON cr.id = p.custom_role_id
   WHERE p.deleted_at IS NULL
     AND p.disabled_at IS NULL
     AND cr.permissions ? 'canManageColaboradores'
     AND p.id IS DISTINCT FROM auth.uid();

  RETURN v_id;
END;
$$;

-- ─── 4. Cancelar (só o dono, só pendente) ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rh_cancelar_solicitacao(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT s.status INTO v_status
    FROM colaborador_solicitacoes_alteracao s
    JOIN colaboradores c ON c.id = s.colaborador_id
   WHERE s.id = p_id AND c.user_profile_id = auth.uid()
   FOR UPDATE OF s;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada.';
  END IF;
  IF v_status <> 'pendente' THEN
    RAISE EXCEPTION 'Esta solicitação não está mais pendente.';
  END IF;

  UPDATE colaborador_solicitacoes_alteracao SET status = 'cancelada' WHERE id = p_id;
END;
$$;

-- ─── 5. Decidir (RH) ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rh_decidir_solicitacao(p_id uuid, p_aprovar boolean, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sol colaborador_solicitacoes_alteracao%ROWTYPE;
  v_novos jsonb;
  v_user_colaborador uuid;
  v_motivo text := nullif(btrim(p_motivo), '');
BEGIN
  IF NOT public.current_user_has_permission('canManageColaboradores') THEN
    RAISE EXCEPTION 'Sem permissão para decidir solicitações (Gerenciar Colaboradores).';
  END IF;
  IF p_aprovar IS NULL THEN
    RAISE EXCEPTION 'Decisão inválida.';
  END IF;
  IF char_length(v_motivo) > 500 THEN
    RAISE EXCEPTION 'O motivo deve ter no máximo 500 caracteres.';
  END IF;

  SELECT * INTO v_sol FROM colaborador_solicitacoes_alteracao WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada.';
  END IF;
  IF v_sol.status <> 'pendente' THEN
    RAISE EXCEPTION 'Esta solicitação não está mais pendente.';
  END IF;

  IF p_aprovar THEN
    SELECT jsonb_object_agg(a->>'campo', a->'para') INTO v_novos
      FROM jsonb_array_elements(v_sol.alteracoes) a;

    -- Só os campos da solicitação mudam; o resto do registro fica como está.
    INSERT INTO colaborador_dados_pessoais AS dp (
      colaborador_id, nacionalidade, uf_nascimento, cidade_nascimento, cor_raca, genero,
      estado_civil, data_nascimento, nome_mae, nome_pai)
    VALUES (
      v_sol.colaborador_id,
      v_novos->>'nacionalidade', v_novos->>'uf_nascimento', v_novos->>'cidade_nascimento',
      v_novos->>'cor_raca', v_novos->>'genero', v_novos->>'estado_civil',
      (v_novos->>'data_nascimento')::date, v_novos->>'nome_mae', v_novos->>'nome_pai')
    ON CONFLICT (colaborador_id) DO UPDATE SET
      nacionalidade     = CASE WHEN v_novos ? 'nacionalidade'     THEN EXCLUDED.nacionalidade     ELSE dp.nacionalidade END,
      uf_nascimento     = CASE WHEN v_novos ? 'uf_nascimento'     THEN EXCLUDED.uf_nascimento     ELSE dp.uf_nascimento END,
      cidade_nascimento = CASE WHEN v_novos ? 'cidade_nascimento' THEN EXCLUDED.cidade_nascimento ELSE dp.cidade_nascimento END,
      cor_raca          = CASE WHEN v_novos ? 'cor_raca'          THEN EXCLUDED.cor_raca          ELSE dp.cor_raca END,
      genero            = CASE WHEN v_novos ? 'genero'            THEN EXCLUDED.genero            ELSE dp.genero END,
      estado_civil      = CASE WHEN v_novos ? 'estado_civil'      THEN EXCLUDED.estado_civil      ELSE dp.estado_civil END,
      data_nascimento   = CASE WHEN v_novos ? 'data_nascimento'   THEN EXCLUDED.data_nascimento   ELSE dp.data_nascimento END,
      nome_mae          = CASE WHEN v_novos ? 'nome_mae'          THEN EXCLUDED.nome_mae          ELSE dp.nome_mae END,
      nome_pai          = CASE WHEN v_novos ? 'nome_pai'          THEN EXCLUDED.nome_pai          ELSE dp.nome_pai END;
  END IF;

  UPDATE colaborador_solicitacoes_alteracao
     SET status = CASE WHEN p_aprovar THEN 'aprovada' ELSE 'recusada' END,
         motivo_recusa = CASE WHEN p_aprovar THEN NULL ELSE v_motivo END,
         decidido_por = auth.uid(),
         decidido_em = now()
   WHERE id = p_id;

  -- Avisa o colaborador (se tiver login e não for quem decidiu).
  SELECT c.user_profile_id INTO v_user_colaborador FROM colaboradores c WHERE c.id = v_sol.colaborador_id;
  IF v_user_colaborador IS NOT NULL AND v_user_colaborador IS DISTINCT FROM auth.uid() THEN
    INSERT INTO user_notifications (user_id, title, content, module, type, link)
    VALUES (
      v_user_colaborador,
      CASE WHEN p_aprovar THEN 'Sua alteração de dados foi aprovada' ELSE 'Sua alteração de dados foi recusada' END,
      CASE WHEN p_aprovar THEN 'Seus dados pessoais foram atualizados.'
           ELSE COALESCE('Motivo: ' || v_motivo, 'Veja os detalhes no Meu perfil.') END,
      'HR',
      CASE WHEN p_aprovar THEN 'success' ELSE 'warning' END,
      '/meu-perfil');
  END IF;
END;
$$;

-- ─── 6. Dispensar o aviso de resultado (só o dono) ─────────────────────────────

CREATE OR REPLACE FUNCTION public.rh_dispensar_resultado(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE colaborador_solicitacoes_alteracao s
     SET resultado_visto_em = now()
    FROM colaboradores c
   WHERE s.id = p_id
     AND c.id = s.colaborador_id
     AND c.user_profile_id = auth.uid()
     AND s.status IN ('aprovada', 'recusada')
     AND s.resultado_visto_em IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.rh_solicitar_alteracao(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rh_cancelar_solicitacao(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rh_decidir_solicitacao(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rh_dispensar_resultado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_solicitar_alteracao(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rh_cancelar_solicitacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rh_decidir_solicitacao(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rh_dispensar_resultado(uuid) TO authenticated;
