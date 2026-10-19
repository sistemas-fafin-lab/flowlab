-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber: a emissão do título acompanha o refechamento do lote no
-- apLIS (.scratch/faturamento-pendencias-e-refechamento, ticket 05).
--
-- A emissão do título é o fechamento do lote. Quando o apLIS refecha o lote
-- (`fatlote.DtaFechamento` muda), o título ficava no mês antigo e a meta não
-- batia com a planilha do setor (R$ 51,7 mil de out/2026). A conferência com o
-- apLIS aponta esses títulos (`refechamentos`); o "Atualizar" da aba Títulos
-- manda os apontados para esta RPC.
--
--   fat_aplicar_refechamentos(p) — p = [{ idNota, emissaoNova }]. Numa
--     transação só, troca `data_emissao` e, só quando a competência era o mês
--     da emissão antiga, `competencia` (a regra da migration de 06/10,
--     20261006120000_contas_receber_emissao_fechamento_lote.sql). Vencimento
--     não muda: sai do RPS ou do envio, não da emissão.
--
-- A data vem do cliente (o apLIS só é lido pela API), então a RPC confere de
-- novo o que importa: título não cancelado e nova data num MÊS posterior ao da
-- emissão atual (diferença só de dia não conta — decidido em 19/10/2026) e não
-- no futuro. Rodar de novo, ou dois operadores ao mesmo tempo, não muda nada.
-- Devolve só os títulos que mudaram, com a emissão de antes e a de depois.
--
-- Não há correção de dados à parte: os títulos apontados em produção (22 em
-- 19/10/2026) entram no primeiro "Atualizar" depois do deploy.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fat_aplicar_refechamentos(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alterados JSONB;
BEGIN
  PERFORM fat_exigir_permissao_gestao();

  IF p IS NULL OR jsonb_typeof(p) <> 'array' THEN
    RAISE EXCEPTION 'Informe a lista de refechamentos.';
  END IF;

  WITH pedidos AS (
    -- Um id repetido no pedido fica com a data mais recente.
    SELECT (e->>'idNota')::UUID AS id_nota, MAX((e->>'emissaoNova')::DATE) AS emissao_nova
      FROM jsonb_array_elements(p) AS e
     GROUP BY 1
  ),
  antes AS (
    SELECT n.id_nota, n.data_emissao, n.competencia, pd.emissao_nova
      FROM notas n
      JOIN pedidos pd ON pd.id_nota = n.id_nota
     WHERE n.status <> 'cancelada'
       AND n.data_emissao IS NOT NULL
       AND date_trunc('month', pd.emissao_nova) > date_trunc('month', n.data_emissao)
       AND pd.emissao_nova <= CURRENT_DATE
       FOR UPDATE OF n
  ),
  alterados AS (
    UPDATE notas n
       SET data_emissao = a.emissao_nova,
           competencia  = CASE WHEN n.competencia = to_char(a.data_emissao, 'YYYY-MM')
                               THEN to_char(a.emissao_nova, 'YYYY-MM')
                               ELSE n.competencia END,
           updated_at   = NOW()
      FROM antes a
     WHERE n.id_nota = a.id_nota
    RETURNING n.id_nota, a.data_emissao AS emissao_antiga, n.data_emissao AS emissao_nova
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'idNota', id_nota,
           'emissaoAntiga', emissao_antiga,
           'emissaoNova', emissao_nova
         )), '[]'::jsonb)
    INTO v_alterados
    FROM alterados;

  RETURN v_alterados;
END;
$$;

COMMENT ON FUNCTION public.fat_aplicar_refechamentos(JSONB) IS 'Aplica a emissão nova dos títulos cujo lote foi refechado no apLIS (p = [{idNota, emissaoNova}]). Ignora título cancelado e data que não seja de um mês posterior ao da emissão atual (ou futura); a competência acompanha só quando era o mês da emissão antiga. Exige canManageBilling. Devolve os títulos alterados.';

REVOKE ALL ON FUNCTION public.fat_aplicar_refechamentos(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fat_aplicar_refechamentos(JSONB) TO authenticated;
