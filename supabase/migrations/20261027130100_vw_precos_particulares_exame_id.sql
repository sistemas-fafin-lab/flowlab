-- Acrescenta o id do exame (custo_exames.id) no fim da view, para a Central
-- identificar o exame sem depender de TUSS + nome (o TUSS se repete).
-- Mesma regra da 20261027120000; colunas novas só no fim (CREATE OR REPLACE
-- VIEW não reordena). Os GRANT/REVOKE da view continuam valendo.
-- exame_id é null no item avulso (TUSS sem exame em custo_exames).

CREATE OR REPLACE VIEW integracao.vw_precos_particulares
WITH (security_invoker = false) AS
WITH fontes AS (
  -- Linha não levantada (nome do convênio sem exame) não é linha geral do TUSS.
  SELECT f.id, f.fonte_pagadora, f.tabela_associada_id, f.tuss, f.exame_id,
         f.valor, f.atendido, f.elegivel_desconto_particular
  FROM public.custo_fontes_pagadoras f
  WHERE f.exame_id IS NOT NULL OR coalesce(f.nome_exame_convenio, '') = ''
),
particulares AS (
  SELECT f.*
  FROM fontes f
  JOIN public.custo_tabelas_associadas t ON t.id = f.tabela_associada_id
  WHERE t.fonte_pagadora = 'Particular' AND lower(btrim(t.nome)) = 'particular'
),
-- Exames agrupados por TUSS, um por nome (o TS fica com o último lido; aqui o
-- mais recente, para ser determinístico). Exame sem TUSS não entra em grupo.
exames_do_tuss AS (
  SELECT DISTINCT ON (e.tuss, e.nome) e.id, e.tuss, e.nome
  FROM public.custo_exames e
  WHERE e.tuss <> ''
  ORDER BY e.tuss, e.nome, e.updated_at DESC, e.id DESC
),
-- Exames com linha Particular própria que de fato os mostra.
com_linha_propria AS (
  SELECT DISTINCT p.exame_id
  FROM particulares p
  WHERE p.exame_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.custo_fontes_pagadoras_exclusoes x
                    WHERE x.payor_id = p.id AND x.exame_id = p.exame_id)
),
itens_por_exame AS (
  SELECT DISTINCT ON (e.id)
         p.id AS fonte_id, e.id AS exame_id, coalesce(nullif(e.tuss, ''), p.tuss) AS tuss,
         e.nome, p.valor, p.elegivel_desconto_particular
  FROM particulares p
  JOIN public.custo_exames e ON e.id = p.exame_id
  WHERE NOT EXISTS (SELECT 1 FROM public.custo_fontes_pagadoras_exclusoes x
                    WHERE x.payor_id = p.id AND x.exame_id = e.id)
  ORDER BY e.id, p.id
),
linhas_gerais AS (
  SELECT DISTINCT ON (p.tuss) p.*
  FROM particulares p
  WHERE p.exame_id IS NULL AND p.tuss <> ''
  ORDER BY p.tuss, p.id
),
itens_por_tuss AS (
  SELECT g.id AS fonte_id, e.id AS exame_id, e.tuss, e.nome, g.valor, g.elegivel_desconto_particular
  FROM linhas_gerais g
  JOIN exames_do_tuss e ON e.tuss = g.tuss
  WHERE e.id NOT IN (SELECT exame_id FROM com_linha_propria)
    AND NOT EXISTS (SELECT 1 FROM public.custo_fontes_pagadoras_exclusoes x
                    WHERE x.payor_id = g.id AND x.exame_id = e.id)
),
-- TUSS sem exame em custo_exames: item avulso, sem nome.
itens_avulsos AS (
  SELECT g.id AS fonte_id, NULL::uuid AS exame_id, g.tuss, NULL::text AS nome, g.valor, g.elegivel_desconto_particular
  FROM linhas_gerais g
  WHERE NOT EXISTS (SELECT 1 FROM exames_do_tuss e WHERE e.tuss = g.tuss)
),
itens AS (
  SELECT * FROM itens_por_exame
  UNION ALL SELECT * FROM itens_por_tuss
  UNION ALL SELECT * FROM itens_avulsos
),
-- Convênios (fontes não Particular): linha de exame substitui a geral do TUSS
-- só para aquele exame. Só nomes, nunca valores.
convenios_gerais AS (
  SELECT tuss, fonte_pagadora, bool_or(atendido) AS atendido
  FROM fontes
  WHERE fonte_pagadora <> 'Particular' AND exame_id IS NULL AND tuss <> ''
  GROUP BY tuss, fonte_pagadora
),
convenios_exame AS (
  SELECT exame_id, fonte_pagadora, bool_or(atendido) AS atendido
  FROM fontes
  WHERE fonte_pagadora <> 'Particular' AND exame_id IS NOT NULL
  GROUP BY exame_id, fonte_pagadora
)
SELECT
  i.tuss,
  i.nome,
  coalesce(v.valor, i.valor) AS preco,
  i.elegivel_desconto_particular AS elegivel_desconto,
  ARRAY(
    SELECT c.fonte_pagadora FROM (
      SELECT cg.fonte_pagadora FROM convenios_gerais cg
      WHERE cg.tuss = i.tuss AND cg.atendido
        AND NOT EXISTS (SELECT 1 FROM convenios_exame ce
                        WHERE ce.exame_id = i.exame_id AND ce.fonte_pagadora = cg.fonte_pagadora)
      UNION
      SELECT ce.fonte_pagadora FROM convenios_exame ce
      WHERE ce.exame_id = i.exame_id AND ce.atendido
    ) c
    ORDER BY c.fonte_pagadora
  )::text[] AS convenios,
  i.exame_id
FROM itens i
LEFT JOIN public.custo_fontes_pagadoras_valores_exame v
  ON v.payor_id = i.fonte_id AND v.exame_id = i.exame_id;

COMMENT ON VIEW integracao.vw_precos_particulares IS
  'Cópia em SQL de buildOrcamentoParticular (api/_lib/orcamentoParticular.ts) para a Central de atendimento. Mudou a regra lá, muda aqui e roda a paridade.';

