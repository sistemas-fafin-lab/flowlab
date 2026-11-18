-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber: retrato do recebido dos lotes lido no SITE do apLIS.
--
-- .scratch/faturamento-recebidos-aplis-site/spec.md. O "Atualizar do apLIS →
-- Baixas" e a "Conferência com o apLIS" liam o recebido só do MySQL de backup
-- (dump diário, ~1 dia de atraso; 2 quando o arquivo do dia chega tarde). Agora
-- o site (`faturamento-ajax.listarBaixa`, uma linha por requisição) é a fonte
-- principal, gravada aqui pela rotina das 07h/12h/17h e pelo botão "Buscar no
-- apLIS agora" (api/_lib/faturamento/recebidosAplisSite.ts); o banco fica de
-- reserva.
--
--   fat_aplis_site_lotes      → quando cada lote foi lido no site
--   fat_aplis_site_recebidos  → as requisições do lote, como o site mostrou
--   fat_aplis_site_capturas   → cada execução (rotina ou botão), para a tela
--                               dizer de quando é o retrato
--
-- Só a API lê e grava (service_role): RLS ligada e sem política.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fat_aplis_site_lotes (
  aplis_lote_id   INTEGER PRIMARY KEY,
  capturado_em    TIMESTAMPTZ NOT NULL,
  qtd_requisicoes INTEGER NOT NULL
);

COMMENT ON TABLE public.fat_aplis_site_lotes IS
  'Lotes lidos no site do apLIS (listarBaixa) e quando. Retrato do recebido; o MySQL de backup é a reserva.';

CREATE TABLE IF NOT EXISTS public.fat_aplis_site_recebidos (
  aplis_lote_id  INTEGER NOT NULL REFERENCES public.fat_aplis_site_lotes(aplis_lote_id) ON DELETE CASCADE,
  id_requisicao  INTEGER NOT NULL,
  valor_liquido  DECIMAL(15, 2) NOT NULL,
  valor_recebido DECIMAL(15, 2) NOT NULL,
  data_recebido  DATE,
  PRIMARY KEY (aplis_lote_id, id_requisicao)
);

COMMENT ON TABLE public.fat_aplis_site_recebidos IS
  'Requisições do lote como a tela de Baixa do apLIS mostrou na captura (VlrLiquido, VlrRecebido, DtaRecebido).';

CREATE TABLE IF NOT EXISTS public.fat_aplis_site_capturas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origem           TEXT NOT NULL CHECK (origem IN ('rotina', 'botao')),
  usuario_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  iniciada_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terminada_em     TIMESTAMPTZ,
  lotes_previstos  INTEGER NOT NULL DEFAULT 0,
  lotes_lidos      INTEGER NOT NULL DEFAULT 0,
  erro             TEXT
);

COMMENT ON TABLE public.fat_aplis_site_capturas IS
  'Cada leitura do recebido no site do apLIS. lotes_lidos < lotes_previstos: parou no limite de tempo, o resto vai na próxima.';

CREATE INDEX IF NOT EXISTS fat_aplis_site_capturas_iniciada_idx
  ON public.fat_aplis_site_capturas (iniciada_em DESC);

ALTER TABLE public.fat_aplis_site_lotes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fat_aplis_site_recebidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fat_aplis_site_capturas  ENABLE ROW LEVEL SECURITY;

-- ─── Gravação atômica de um bloco de lotes ────────────────────────────────────
-- p: [{ lote, capturadoEm, requisicoes: [{ id, liquido, recebido, data }] }].
-- Troca as requisições de cada lote numa transação: quem lê no meio nunca vê o
-- lote com a hora nova e sem requisições (seria lido como "nada recebido").

CREATE OR REPLACE FUNCTION public.fat_gravar_recebidos_aplis_site(p JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lotes INTEGER[];
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'array' THEN
    RAISE EXCEPTION 'Informe a lista de lotes.';
  END IF;

  SELECT array_agg(DISTINCT (e->>'lote')::INTEGER) INTO v_lotes FROM jsonb_array_elements(p) AS e;
  IF v_lotes IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO fat_aplis_site_lotes (aplis_lote_id, capturado_em, qtd_requisicoes)
  SELECT DISTINCT ON ((e->>'lote')::INTEGER)
         (e->>'lote')::INTEGER,
         (e->>'capturadoEm')::TIMESTAMPTZ,
         jsonb_array_length(COALESCE(e->'requisicoes', '[]'::JSONB))
    FROM jsonb_array_elements(p) AS e
  ON CONFLICT (aplis_lote_id) DO UPDATE
     SET capturado_em    = EXCLUDED.capturado_em,
         qtd_requisicoes = EXCLUDED.qtd_requisicoes;

  DELETE FROM fat_aplis_site_recebidos WHERE aplis_lote_id = ANY (v_lotes);

  INSERT INTO fat_aplis_site_recebidos (aplis_lote_id, id_requisicao, valor_liquido, valor_recebido, data_recebido)
  SELECT (e->>'lote')::INTEGER,
         (r->>'id')::INTEGER,
         SUM((r->>'liquido')::DECIMAL),
         SUM((r->>'recebido')::DECIMAL),
         MAX(NULLIF(r->>'data', '')::DATE)
    FROM jsonb_array_elements(p) AS e,
         jsonb_array_elements(COALESCE(e->'requisicoes', '[]'::JSONB)) AS r
   GROUP BY 1, 2;

  RETURN array_length(v_lotes, 1);
END;
$$;

REVOKE ALL ON FUNCTION public.fat_gravar_recebidos_aplis_site(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fat_gravar_recebidos_aplis_site(JSONB) TO service_role;
