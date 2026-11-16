-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber: os títulos acompanham o apLIS pela sincronização.
--
-- Os lotes eram uma foto do apLIS no instante em que entravam no título e nunca
-- mais mudavam. A sincronização diária (a mesma das glosas, 06h) e o
-- "Atualizar" de Glosas e Recursos passam a chamar fat_sincronizar_titulos_aplis
-- com os dados de hoje de cada lote (api/_lib/faturamento/sincronizarTitulosAplis.ts),
-- e ela, numa transação:
--
--   1. regrava nos lotes o status do apLIS (que é o status do título na aba
--      Títulos), o envio, o protocolo, a NF-e, o RPS e quem fechou o lote. Dado
--      que o apLIS não tem (null) não apaga o que já estava gravado;
--   2. preenche o número da nota dos títulos sem número cujos lotes têm todos a
--      mesma NF-e — a regra do "Atualizar do apLIS" (titulos-aplis-previa);
--   3. aplica a emissão nova dos títulos cujo lote foi refechado no apLIS — a
--      regra de fat_aplicar_refechamentos (20261019180000), que passa a ter o
--      miolo em fat_aplicar_refechamentos_sem_permissao.
--
-- Fica de fora de propósito: valor total e quantidade de requisições (congelados
-- na criação — a conferência aponta a diferença), vencimento (o do RPS erra o
-- pagamento em 42 dias, mediana), baixas e criação de títulos (com prévia).
--
-- `notas.status` (aberta/parcial/recebida/…) continua calculado pelas baixas e
-- alimenta o atalho "Somente pendentes"; o cancelamento do título continua
-- manual e vence o status do apLIS na tela.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.lotes ADD COLUMN IF NOT EXISTS status_aplis_atualizado_em TIMESTAMPTZ;

COMMENT ON COLUMN public.lotes.status_aplis IS
  'Código STLOT do fatlote.Status no apLIS. Regravado pela sincronização diária (fat_sincronizar_titulos_aplis); é o status do título na aba Títulos.';
COMMENT ON COLUMN public.lotes.status_aplis_atualizado_em IS
  'Quando a sincronização viu o status do lote mudar no apLIS. Nulo: o status é o da criação do título (data_snapshot).';
COMMENT ON COLUMN public.lotes.data_snapshot IS
  'Quando os valores foram copiados do apLIS na criação do título. Valor total e qtd. de requisições ficam congelados; status, envio, protocolo, NF-e, RPS e responsável seguem o apLIS pela sincronização diária.';

CREATE INDEX IF NOT EXISTS idx_lotes_status_aplis ON public.lotes (status_aplis);

-- ─── Refechamento: miolo sem a checagem de permissão ─────────────────────────
-- Mesmo corpo de 20261019180000; a checagem de canManageBilling fica no
-- invólucro chamado pela tela. A sincronização roda como service_role, sem
-- usuário, e chama o miolo direto.

CREATE OR REPLACE FUNCTION public.fat_aplicar_refechamentos_sem_permissao(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alterados JSONB;
BEGIN
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

COMMENT ON FUNCTION public.fat_aplicar_refechamentos_sem_permissao(JSONB) IS 'Miolo de fat_aplicar_refechamentos, sem a checagem de canManageBilling: só para service_role (sincronização) e para o invólucro.';

REVOKE ALL ON FUNCTION public.fat_aplicar_refechamentos_sem_permissao(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fat_aplicar_refechamentos_sem_permissao(JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.fat_aplicar_refechamentos(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM fat_exigir_permissao_gestao();
  RETURN fat_aplicar_refechamentos_sem_permissao(p);
END;
$$;

COMMENT ON FUNCTION public.fat_aplicar_refechamentos(JSONB) IS 'Aplica a emissão nova dos títulos cujo lote foi refechado no apLIS (p = [{idNota, emissaoNova}]). Ignora título cancelado e data que não seja de um mês posterior ao da emissão atual (ou futura); a competência acompanha só quando era o mês da emissão antiga. Exige canManageBilling. Devolve os títulos alterados.';

-- ─── Sincronização dos títulos ────────────────────────────────────────────────
-- p_lotes: um item por lote encontrado no apLIS —
--   { aplis_id, status_aplis, status, data_envio, data_fechamento, protocolo,
--     nfe_numero, numero_rps, responsavel_fechamento }
-- Devolve { lotesAtualizados, statusMudaram, numerosPreenchidos, refechamentos }.

CREATE OR REPLACE FUNCTION public.fat_sincronizar_titulos_aplis(p_lotes JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_lotes INTEGER;
  v_status INTEGER;
  v_numeros INTEGER;
  v_pedidos JSONB;
  v_refechamentos JSONB;
BEGIN
  IF p_lotes IS NULL OR jsonb_typeof(p_lotes) <> 'array' THEN
    RAISE EXCEPTION 'Informe a lista de lotes.';
  END IF;

  -- A rotina diária e o botão podem coincidir: um de cada vez.
  PERFORM pg_advisory_xact_lock(hashtext('fat_sincronizar_titulos_aplis'));

  -- 1. Lotes. Só toca o lote em que algo muda; o que o apLIS não tem não apaga.
  WITH alvo AS (
    SELECT l.id_lote,
           x.status_aplis,
           x.status,
           l.status_aplis IS DISTINCT FROM x.status_aplis AS mudou_status,
           l.status_aplis IS NOT NULL AS tinha_status,
           COALESCE(x.data_envio, l.data_envio) AS data_envio,
           COALESCE(x.protocolo, l.protocolo) AS protocolo,
           COALESCE(x.nfe_numero, l.nfe_numero) AS nfe_numero,
           COALESCE(x.numero_rps, l.numero_rps) AS numero_rps,
           COALESCE(x.responsavel_fechamento, l.responsavel_fechamento) AS responsavel_fechamento
      FROM lotes l
      JOIN jsonb_to_recordset(p_lotes) AS x(
             aplis_id TEXT, status_aplis SMALLINT, status TEXT, data_envio DATE,
             protocolo TEXT, nfe_numero TEXT, numero_rps INTEGER, responsavel_fechamento TEXT
           ) ON x.aplis_id = l.aplis_id
     WHERE l.status_aplis IS DISTINCT FROM x.status_aplis
        OR l.status IS DISTINCT FROM x.status
        OR l.data_envio IS DISTINCT FROM COALESCE(x.data_envio, l.data_envio)
        OR l.protocolo IS DISTINCT FROM COALESCE(x.protocolo, l.protocolo)
        OR l.nfe_numero IS DISTINCT FROM COALESCE(x.nfe_numero, l.nfe_numero)
        OR l.numero_rps IS DISTINCT FROM COALESCE(x.numero_rps, l.numero_rps)
        OR l.responsavel_fechamento IS DISTINCT FROM COALESCE(x.responsavel_fechamento, l.responsavel_fechamento)
       FOR UPDATE OF l
  ),
  atualizados AS (
    UPDATE lotes l
       SET status_aplis = a.status_aplis,
           status = a.status,
           -- Sem status anterior gravado não há mudança vista: a tela usa data_snapshot.
           status_aplis_atualizado_em = CASE WHEN a.mudou_status AND a.tinha_status
                                             THEN NOW() ELSE l.status_aplis_atualizado_em END,
           data_envio = a.data_envio,
           protocolo = a.protocolo,
           nfe_numero = a.nfe_numero,
           numero_rps = a.numero_rps,
           responsavel_fechamento = a.responsavel_fechamento,
           updated_at = NOW()
      FROM alvo a
     WHERE l.id_lote = a.id_lote
    RETURNING a.mudou_status
  )
  SELECT COUNT(*), COUNT(*) FILTER (WHERE mudou_status)
    INTO v_lotes, v_status
    FROM atualizados;

  -- 2. Número da nota: título sem número, não cancelado, com todos os lotes do
  --    apLIS e a mesma NF-e em todos. Mesma regra do "Atualizar do apLIS".
  WITH nfes AS (
    SELECT nl.id_nota,
           COUNT(*) AS lotes,
           COUNT(l.aplis_id) AS com_aplis,
           COUNT(NULLIF(TRIM(l.nfe_numero), '')) AS com_nfe,
           COUNT(DISTINCT NULLIF(TRIM(l.nfe_numero), '')) AS distintas,
           MIN(NULLIF(TRIM(l.nfe_numero), '')) AS nfe
      FROM nota_lote nl
      JOIN lotes l ON l.id_lote = nl.id_lote
     GROUP BY nl.id_nota
  ),
  preenchidos AS (
    UPDATE notas n
       SET numero_nota = f.nfe
      FROM nfes f
     WHERE n.id_nota = f.id_nota
       AND n.status <> 'cancelada'
       AND NULLIF(TRIM(n.numero_nota), '') IS NULL
       AND f.com_aplis = f.lotes
       AND f.com_nfe = f.lotes
       AND f.distintas = 1
    RETURNING n.id_nota
  )
  SELECT COUNT(*) INTO v_numeros FROM preenchidos;

  -- 3. Refechamento: emissão nova = fechamento mais recente entre os lotes, só
  --    com todos os lotes do título fechados no apLIS. O miolo aplica a regra do mês.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('idNota', id_nota, 'emissaoNova', fechamento)), '[]'::jsonb)
    INTO v_pedidos
    FROM (
      SELECT nl.id_nota, MAX(x.data_fechamento) AS fechamento
        FROM nota_lote nl
        JOIN lotes l ON l.id_lote = nl.id_lote
        LEFT JOIN jsonb_to_recordset(p_lotes) AS x(aplis_id TEXT, data_fechamento DATE)
               ON x.aplis_id = l.aplis_id
       GROUP BY nl.id_nota
      HAVING COUNT(*) = COUNT(x.data_fechamento)
    ) t;
  v_refechamentos := fat_aplicar_refechamentos_sem_permissao(v_pedidos);

  RETURN jsonb_build_object(
    'lotesAtualizados', v_lotes,
    'statusMudaram', v_status,
    'numerosPreenchidos', v_numeros,
    'refechamentos', v_refechamentos
  );
END;
$$;

COMMENT ON FUNCTION public.fat_sincronizar_titulos_aplis(JSONB) IS 'Sincronização diária dos títulos com o apLIS: dados dos lotes (status, envio, protocolo, NF-e, RPS, responsável), número da nota dos títulos sem número e refechamentos. Só service_role.';

REVOKE ALL ON FUNCTION public.fat_sincronizar_titulos_aplis(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fat_sincronizar_titulos_aplis(JSONB) TO service_role;
