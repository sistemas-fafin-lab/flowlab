-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — Colaborador edita os próprios dados pessoais direto, sem aprovação do RH
--
-- Substitui o fluxo de 20261030150000_rh_solicitacao_alteracao (o colaborador
-- solicitava, o RH aprovava ou recusava). Agora o Meu perfil grava na hora pela RPC
-- rh_atualizar_meus_dados_pessoais, com as mesmas travas da antiga solicitação:
-- só o próprio cadastro, só os 9 campos editáveis (nome e CPF continuam com o RH),
-- mesma validação de valores e data de nascimento não futura.
--
-- A tabela colaborador_solicitacoes_alteracao fica como histórico: cada gravação
-- entra como 'aprovada', decidida pelo próprio colaborador e com o aviso já visto
-- (resultado_visto_em), para não gerar banner. Pendentes antigas são canceladas.
-- O RH não recebe mais notificação.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Pendentes do fluxo antigo ───────────────────────────────────────────────
-- Ninguém mais decide essas solicitações; o colaborador refaz a edição se quiser.

UPDATE public.colaborador_solicitacoes_alteracao
   SET status = 'cancelada'
 WHERE status = 'pendente';

-- ─── 2. Remove as RPCs do fluxo de aprovação ───────────────────────────────────

DROP FUNCTION IF EXISTS public.rh_solicitar_alteracao(jsonb);
DROP FUNCTION IF EXISTS public.rh_cancelar_solicitacao(uuid);
DROP FUNCTION IF EXISTS public.rh_decidir_solicitacao(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.rh_dispensar_resultado(uuid);

COMMENT ON TABLE public.colaborador_solicitacoes_alteracao IS
  'Histórico das alterações de dados pessoais feitas pelo próprio colaborador no Meu perfil (rh_atualizar_meus_dados_pessoais). Até 20261106130000 também guardava as solicitações decididas pelo RH.';

-- ─── 3. Gravar os próprios dados pessoais ──────────────────────────────────────
-- alteracoes = [{ "campo": <coluna de colaborador_dados_pessoais>, "para": <valor> }]
-- Valores como texto JSON (data em "YYYY-MM-DD") ou null. "de" é calculado aqui.

CREATE OR REPLACE FUNCTION public.rh_atualizar_meus_dados_pessoais(p_alteracoes jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campos constant text[] := ARRAY[
    'nacionalidade', 'uf_nascimento', 'cidade_nascimento', 'cor_raca', 'genero',
    'estado_civil', 'data_nascimento', 'nome_mae', 'nome_pai'];
  v_colaborador_id uuid;
  v_atual jsonb;
  v_item jsonb;
  v_campo text;
  v_para text;
  v_de text;
  v_alteracoes jsonb := '[]'::jsonb;
  v_novos jsonb;
  v_vistos text[] := '{}';
BEGIN
  SELECT c.id INTO v_colaborador_id
    FROM colaboradores c WHERE c.user_profile_id = auth.uid();
  IF v_colaborador_id IS NULL THEN
    RAISE EXCEPTION 'Seu usuário não está vinculado a um cadastro de colaborador.';
  END IF;

  IF p_alteracoes IS NULL OR jsonb_typeof(p_alteracoes) <> 'array' THEN
    RAISE EXCEPTION 'Formato de alterações inválido.';
  END IF;

  SELECT to_jsonb(dp) INTO v_atual
    FROM colaborador_dados_pessoais dp WHERE dp.colaborador_id = v_colaborador_id
   FOR UPDATE;
  v_atual := COALESCE(v_atual, '{}'::jsonb);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_alteracoes) LOOP
    v_campo := v_item->>'campo';
    -- Um campo fora da lista (nome, CPF, ...) recusa a gravação inteira.
    IF v_campo IS NULL OR NOT (v_campo = ANY (v_campos)) THEN
      RAISE EXCEPTION 'Campo não permitido: %', COALESCE(v_campo, '(vazio)');
    END IF;
    IF v_campo = ANY (v_vistos) THEN
      RAISE EXCEPTION 'Campo repetido: %', v_campo;
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
    RAISE EXCEPTION 'Nenhuma alteração para salvar.';
  END IF;

  SELECT jsonb_object_agg(a->>'campo', a->'para') INTO v_novos
    FROM jsonb_array_elements(v_alteracoes) a;

  -- Só os campos alterados mudam; o resto do registro fica como está.
  INSERT INTO colaborador_dados_pessoais AS dp (
    colaborador_id, nacionalidade, uf_nascimento, cidade_nascimento, cor_raca, genero,
    estado_civil, data_nascimento, nome_mae, nome_pai)
  VALUES (
    v_colaborador_id,
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

  -- Histórico: quem mudou o quê, de quanto para quanto.
  INSERT INTO colaborador_solicitacoes_alteracao (
    colaborador_id, solicitado_por, alteracoes, status, decidido_por, decidido_em, resultado_visto_em)
  VALUES (v_colaborador_id, auth.uid(), v_alteracoes, 'aprovada', auth.uid(), now(), now());
END;
$$;

REVOKE ALL ON FUNCTION public.rh_atualizar_meus_dados_pessoais(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_atualizar_meus_dados_pessoais(jsonb) TO authenticated;

COMMIT;
