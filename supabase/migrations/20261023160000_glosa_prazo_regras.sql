-- ═══════════════════════════════════════════════════════════════════════════════
-- Glosas e Recursos — regras de prazo por convênio
-- Migration: 20261023160000_glosa_prazo_regras.sql
--
-- Issue 03 de .scratch/glosas-recursos-dashboard/. Cada convênio tem quatro
-- regras de prazo — Pagamento (fatura), Glosa – Recurso, Glosa – Análise e
-- Glosa – Pagamento — e se liga a uma ou mais fontes pagadoras do apLIS (os
-- dois cadastros do Bradesco, por exemplo). O cálculo das datas a partir da
-- regra é do ticket 04 (api/_lib/faturamento/recursoGlosa.ts).
--
--   glosa_prazo_regras              → convênio + as quatro regras
--   glosa_prazo_regra_fontes        → vínculo regra ↔ fonte pagadora do apLIS
--   glosa_recurso_fontes_sem_regra  → fontes com glosa ou recurso na foto e
--                                     sem regra ligada
--   glosa_prazo_salvar_regra()      → grava um convênio e as fontes dele numa
--                                     transação
--
-- Tipos de regra: dias_corridos (N), dias_uteis (N), dia_mes_seguinte (dia N),
-- dia_util_mes_seguinte (N-ésimo dia útil), ultimo_dia_mes_seguinte e
-- sem_prazo. `*_texto` guarda o texto da planilha da responsável pelas glosas,
-- para quem completar uma regra "sem prazo" saber o que o contrato diz.
--
-- RLS no padrão do faturamento (20260807120000): lê quem vê o faturamento,
-- edita quem gerencia. A tela grava com o cliente da sessão.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
  IF to_regclass('public.glosa_recurso_requisicoes') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.glosa_recurso_requisicoes não existe. Aplique 20261023150000_glosa_recurso_foto.sql antes desta migration.';
  END IF;
END $$;

-- ─── Regras ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.glosa_prazo_regras (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convenio              TEXT NOT NULL UNIQUE CHECK (btrim(convenio) <> ''),
  pagamento_fatura_tipo TEXT NOT NULL DEFAULT 'sem_prazo',
  pagamento_fatura_n    INTEGER,
  pagamento_fatura_texto TEXT,
  glosa_recurso_tipo    TEXT NOT NULL DEFAULT 'sem_prazo',
  glosa_recurso_n       INTEGER,
  glosa_recurso_texto   TEXT,
  glosa_analise_tipo    TEXT NOT NULL DEFAULT 'sem_prazo',
  glosa_analise_n       INTEGER,
  glosa_analise_texto   TEXT,
  glosa_pagamento_tipo  TEXT NOT NULL DEFAULT 'sem_prazo',
  glosa_pagamento_n     INTEGER,
  glosa_pagamento_texto TEXT,
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_por        UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Mesmas regras de src/modules/faturamento/utils/regraPrazo.ts (lerRegraPrazo):
-- N só nos tipos que contam, inteiro ≥ 1, dia do mês ≤ 31, dia útil ≤ 23.
-- COALESCE: com N nulo o CASE dá NULL, e um CHECK nulo passa.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['pagamento_fatura','glosa_recurso','glosa_analise','glosa_pagamento']
  LOOP
    EXECUTE format('ALTER TABLE public.glosa_prazo_regras DROP CONSTRAINT IF EXISTS %I', r || '_regra_check');
    EXECUTE format($f$
      ALTER TABLE public.glosa_prazo_regras ADD CONSTRAINT %1$I CHECK (COALESCE(
        CASE %2$I
          WHEN 'dias_corridos'           THEN %3$I >= 1
          WHEN 'dias_uteis'              THEN %3$I >= 1
          WHEN 'dia_mes_seguinte'        THEN %3$I BETWEEN 1 AND 31
          WHEN 'dia_util_mes_seguinte'   THEN %3$I BETWEEN 1 AND 23
          WHEN 'ultimo_dia_mes_seguinte' THEN %3$I IS NULL
          WHEN 'sem_prazo'               THEN %3$I IS NULL
          ELSE FALSE
        END, FALSE)
      )$f$, r || '_regra_check', r || '_tipo', r || '_n');
  END LOOP;
END $$;

COMMENT ON TABLE public.glosa_prazo_regras IS 'Regras de prazo por convênio da tela Glosas e Recursos. Pagamento (fatura) só é guardada nesta entrega.';
COMMENT ON COLUMN public.glosa_prazo_regras.glosa_recurso_tipo IS 'Prazo para recorrer, contado da data de recebimento da requisição.';
COMMENT ON COLUMN public.glosa_prazo_regras.glosa_analise_tipo IS 'Data de retorno prevista, contada da data de envio do lote de recurso.';
COMMENT ON COLUMN public.glosa_prazo_regras.glosa_pagamento_tipo IS 'Data de pagamento prevista, contada da data de retorno (real ou prevista).';

-- ─── Vínculo com as fontes pagadoras do apLIS ─────────────────────────────────
-- Uma fonte pagadora segue uma regra só: a PK em id_fonte_pagadora impede que
-- duas regras disputem o mesmo cadastro.
CREATE TABLE IF NOT EXISTS public.glosa_prazo_regra_fontes (
  id_fonte_pagadora   INTEGER PRIMARY KEY,
  regra_id            UUID NOT NULL REFERENCES public.glosa_prazo_regras(id) ON DELETE CASCADE,
  fonte_pagadora_nome TEXT NOT NULL,
  ligado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ligado_por          UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.glosa_prazo_regra_fontes IS 'Fontes pagadoras do apLIS (fatinstituicao.IdInstituicao) ligadas a uma regra de prazo.';

CREATE INDEX IF NOT EXISTS glosa_prazo_regra_fontes_regra_idx
  ON public.glosa_prazo_regra_fontes (regra_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.glosa_prazo_regras       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glosa_prazo_regra_fontes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  p record;
  ver text := '(public.current_user_has_permission(''canViewBilling'') OR public.current_user_has_permission(''canManageBilling''))';
  gerir text := 'public.current_user_has_permission(''canManageBilling'')';
BEGIN
  FOREACH t IN ARRAY ARRAY['glosa_prazo_regras','glosa_prazo_regra_fontes']
  LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
                   t || '_select_billing', t, ver);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
                   t || '_insert_billing', t, gerir);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
                   t || '_update_billing', t, gerir, gerir);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)',
                   t || '_delete_billing', t, gerir);
  END LOOP;
END $$;

-- ─── Gravação de um convênio ──────────────────────────────────────────────────
-- A regra e as fontes ligadas numa transação só: a tela não pode deixar uma
-- regra gravada com metade do vínculo. SECURITY INVOKER: a RLS das duas
-- tabelas vale como em qualquer gravação da sessão. `p_regra` traz as colunas
-- de glosa_prazo_regras (convenio e <regra>_tipo/_n/_texto); `p_fontes`, um
-- array de {id, nome}. As fontes que saem perdem o vínculo; as que entram
-- passam para esta regra, mesmo que estivessem ligadas a outra.
CREATE OR REPLACE FUNCTION public.glosa_prazo_salvar_regra(p_id UUID, p_regra JSONB, p_fontes JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.current_user_has_permission('canManageBilling') THEN
    RAISE EXCEPTION 'Sem permissão para alterar as regras de prazo.' USING ERRCODE = '42501';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.glosa_prazo_regras (
      convenio,
      pagamento_fatura_tipo, pagamento_fatura_n, pagamento_fatura_texto,
      glosa_recurso_tipo,    glosa_recurso_n,    glosa_recurso_texto,
      glosa_analise_tipo,    glosa_analise_n,    glosa_analise_texto,
      glosa_pagamento_tipo,  glosa_pagamento_n,  glosa_pagamento_texto,
      atualizado_por
    )
    SELECT
      btrim(r.convenio),
      r.pagamento_fatura_tipo, r.pagamento_fatura_n, r.pagamento_fatura_texto,
      r.glosa_recurso_tipo,    r.glosa_recurso_n,    r.glosa_recurso_texto,
      r.glosa_analise_tipo,    r.glosa_analise_n,    r.glosa_analise_texto,
      r.glosa_pagamento_tipo,  r.glosa_pagamento_n,  r.glosa_pagamento_texto,
      auth.uid()
    FROM jsonb_populate_record(NULL::public.glosa_prazo_regras, p_regra) r
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.glosa_prazo_regras g SET
      convenio               = btrim(r.convenio),
      pagamento_fatura_tipo  = r.pagamento_fatura_tipo,
      pagamento_fatura_n     = r.pagamento_fatura_n,
      pagamento_fatura_texto = r.pagamento_fatura_texto,
      glosa_recurso_tipo     = r.glosa_recurso_tipo,
      glosa_recurso_n        = r.glosa_recurso_n,
      glosa_recurso_texto    = r.glosa_recurso_texto,
      glosa_analise_tipo     = r.glosa_analise_tipo,
      glosa_analise_n        = r.glosa_analise_n,
      glosa_analise_texto    = r.glosa_analise_texto,
      glosa_pagamento_tipo   = r.glosa_pagamento_tipo,
      glosa_pagamento_n      = r.glosa_pagamento_n,
      glosa_pagamento_texto  = r.glosa_pagamento_texto,
      atualizado_em          = NOW(),
      atualizado_por         = auth.uid()
    FROM jsonb_populate_record(NULL::public.glosa_prazo_regras, p_regra) r
    WHERE g.id = p_id
    RETURNING g.id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Convênio não encontrado: pode ter sido excluído.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  DELETE FROM public.glosa_prazo_regra_fontes v
  WHERE v.regra_id = v_id
    AND v.id_fonte_pagadora NOT IN (SELECT (f->>'id')::INTEGER FROM jsonb_array_elements(p_fontes) f);

  INSERT INTO public.glosa_prazo_regra_fontes (id_fonte_pagadora, regra_id, fonte_pagadora_nome, ligado_por)
  SELECT (f->>'id')::INTEGER, v_id, f->>'nome', auth.uid()
  FROM jsonb_array_elements(p_fontes) f
  ON CONFLICT (id_fonte_pagadora) DO UPDATE SET
    regra_id            = EXCLUDED.regra_id,
    fonte_pagadora_nome = EXCLUDED.fonte_pagadora_nome,
    ligado_em           = NOW(),
    ligado_por          = EXCLUDED.ligado_por
  WHERE public.glosa_prazo_regra_fontes.regra_id IS DISTINCT FROM EXCLUDED.regra_id;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.glosa_prazo_salvar_regra(UUID, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.glosa_prazo_salvar_regra(UUID, JSONB, JSONB) TO authenticated;

-- ─── Fontes com glosa ou recurso sem regra ────────────────────────────────────
-- security_invoker: a view respeita a RLS de quem consulta.
CREATE OR REPLACE VIEW public.glosa_recurso_fontes_sem_regra
WITH (security_invoker = true) AS
WITH fontes AS (
  SELECT id_fonte_pagadora, fonte_pagadora_nome FROM public.glosa_recurso_requisicoes
  UNION ALL
  SELECT id_fonte_pagadora, fonte_pagadora_nome FROM public.glosa_recurso_lotes
)
SELECT
  f.id_fonte_pagadora,
  MAX(f.fonte_pagadora_nome) AS fonte_pagadora_nome,
  COUNT(*)::INTEGER          AS ocorrencias
FROM fontes f
WHERE f.id_fonte_pagadora IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.glosa_prazo_regra_fontes v WHERE v.id_fonte_pagadora = f.id_fonte_pagadora
  )
GROUP BY f.id_fonte_pagadora;

COMMENT ON VIEW public.glosa_recurso_fontes_sem_regra IS 'Fontes pagadoras na foto de glosas e recursos sem regra de prazo ligada. ocorrencias = requisições + lotes de recurso.';

GRANT SELECT ON public.glosa_recurso_fontes_sem_regra TO authenticated;

-- ─── Carga inicial: planilha da responsável pelas glosas ──────────────────────
-- Interpretação (spec, Further Notes): "N dias" sem qualificação = corridos;
-- "20º dia útil" (Cassi, glosa – pagamento) = 20º dia útil do mês seguinte;
-- "20 dias" (Fascal, glosa – pagamento) = 20 dias corridos. Vazio, não claro,
-- "sem prazo definido", "após solicitação de NF", "conforme cronograma" e os
-- prazos contados da NF ou da entrega entram como sem prazo, com o texto.
-- ON CONFLICT DO NOTHING: reaplicar não desfaz o que a responsável editou.
INSERT INTO public.glosa_prazo_regras (
  convenio,
  pagamento_fatura_tipo, pagamento_fatura_n, pagamento_fatura_texto,
  glosa_recurso_tipo,    glosa_recurso_n,    glosa_recurso_texto,
  glosa_analise_tipo,    glosa_analise_n,    glosa_analise_texto,
  glosa_pagamento_tipo,  glosa_pagamento_n,  glosa_pagamento_texto
) VALUES
  ('ASSEFAZ',      'dia_mes_seguinte', 20, 'dia 20 do mês subsequente da fatura',  'dias_corridos', 60, '60 dias',  'dias_corridos', 60, '60 dias',            'dias_corridos', 60, '60 dias'),
  ('AMIL',         'sem_prazo', NULL, '30 dias após entrega',                      'dias_corridos', 90, '90 dias',  'dias_corridos', 90, '90 dias',            'dias_corridos', 30, '30 dias'),
  ('AMHP',         'sem_prazo', NULL, NULL,                                        'sem_prazo', NULL, NULL,         'sem_prazo', NULL, NULL,                   'sem_prazo', NULL, NULL),
  ('AMPLA',        'sem_prazo', NULL, '90 dias após a NF',                         'sem_prazo', NULL, NULL,         'sem_prazo', NULL, NULL,                   'sem_prazo', NULL, NULL),
  ('BRADESCO',     'dias_corridos', 45, '45 dias após receber fatura',             'dias_corridos', 90, '90 dias',  'dias_corridos', 90, '90 dias',            'dias_corridos', 90, '90 dias'),
  ('BRB',          'dias_corridos', 60, '60 dias',                                 'dias_corridos', 60, '60 dias',  'sem_prazo', NULL, 'não clara',            'dias_corridos', 60, '60 dias'),
  ('CAMARA',       'dias_corridos', 60, '60 dias',                                 'dias_corridos', 30, '30 dias',  'dias_corridos', 30, '30 dias',            'dias_corridos', 60, '60 dias'),
  ('CASSI',        'dias_corridos', 30, '30 dias',                                 'dias_corridos', 60, '60 dias',  'sem_prazo', NULL, NULL,                   'dia_util_mes_seguinte', 20, '20º dia útil'),
  ('CBMDF',        'sem_prazo', NULL, '30 dias após NF',                           'dias_corridos', 30, '30 dias',  'dias_corridos', 60, '60 dias',            'dias_corridos', 30, '30 dias'),
  ('E-VIDA',       'dias_corridos', 35, '35 dias',                                 'dias_corridos', 20, '20 dias',  'dias_corridos', 20, '20 dias',            'dias_corridos', 60, '60 dias'),
  ('FASCAL',       'dias_uteis', 20, 'até o 20º dia útil após o recebimento da fatura', 'dias_corridos', 60, '60 dias', 'dias_corridos', 90, '90 dias',         'dias_corridos', 20, '20 dias'),
  ('FUSEX',        'dias_corridos', 60, '60 dias',                                 'dias_corridos', 45, '45 dias',  'dias_corridos', 30, '30 dias',            'dias_corridos', 30, '30 dias'),
  ('GAMA',         'dias_corridos', 60, '60 dias',                                 'dias_corridos', 60, '60 dias',  'dias_corridos', 60, '60 dias',            'dias_corridos', 60, '60 dias'),
  ('GEAP',         'dias_corridos', 90, '90 dias',                                 'dias_corridos', 60, '60 dias',  'dias_corridos', 60, '60 dias',            'dias_corridos', 90, '90 dias'),
  ('INAS',         'dias_corridos', 30, '30 dias',                                 'dias_corridos', 30, '30 dias',  'dias_corridos', 60, '60 dias',            'sem_prazo', NULL, '4 meses (conforme cronograma no e-mail)'),
  ('PF',           'ultimo_dia_mes_seguinte', NULL, 'até o último dia do mês subsequente', 'dias_corridos', 60, '60 dias', 'dias_corridos', 90, '90 dias',      'dias_corridos', 60, '60 dias'),
  ('PLAN ASSISTE', 'dias_corridos', 30, '30 dias',                                 'dias_corridos', 90, '90 dias',  'sem_prazo', NULL, 'não clara',            'sem_prazo', NULL, 'não clara'),
  ('PMDF',         'sem_prazo', NULL, '30 dias após NF',                           'dias_corridos', 30, '30 dias',  'dias_corridos', 30, '30 dias',            'sem_prazo', NULL, '30 dias após NF'),
  ('POSTAL SAÚDE', 'dias_corridos', 60, 'até 60 dias',                             'dias_corridos', 60, '60 dias',  'dias_corridos', 60, '60 dias',            'ultimo_dia_mes_seguinte', NULL, 'último dia do mês subsequente'),
  ('SAÚDE CAIXA',  'dias_corridos', 30, '30 dias',                                 'dias_corridos', 60, '60 dias',  'dias_corridos', 60, '60 dias',            'dias_corridos', 30, '30 dias'),
  ('SELECT',       'sem_prazo', NULL, 'do dia 25 até o último dia do mês subsequente da entrega', 'sem_prazo', NULL, NULL, 'sem_prazo', NULL, NULL,           'sem_prazo', NULL, NULL),
  ('SIS SENADO',   'dias_corridos', 60, '60 dias',                                 'dias_corridos', 90, '90 dias',  'dias_corridos', 45, '45 dias',            'dias_corridos', 60, '60 dias'),
  ('STF-MED',      'sem_prazo', NULL, '30 dias após o 1º dia útil de recebimento da NF', 'dias_corridos', 60, '60 dias', 'dias_corridos', 60, '60 dias',        'dias_corridos', 30, '30 dias'),
  ('STM',          'dias_corridos', 60, '60 dias',                                 'sem_prazo', NULL, NULL,         'sem_prazo', NULL, NULL,                   'sem_prazo', NULL, NULL),
  ('STJ',          'sem_prazo', NULL, '10 dias contando do 1º dia útil do mês subsequente da NF', 'dias_corridos', 120, '120 dias', 'dias_corridos', 60, '60 dias', 'sem_prazo', NULL, 'após solicitação de NF'),
  ('SUL AMERICA',  'dias_corridos', 35, '35 dias',                                 'dias_corridos', 90, '90 dias',  'dias_corridos', 90, '90 dias',            'dias_corridos', 35, '35 dias'),
  ('TJDFT',        'sem_prazo', NULL, '30 dias após NF',                           'dias_corridos', 60, '60 dias',  'dias_corridos', 60, '60 dias',            'dias_corridos', 30, '30 dias'),
  ('TRE',          'sem_prazo', NULL, '30 dias após NF',                           'dias_corridos', 60, '60 dias',  'dias_corridos', 60, '60 dias',            'dias_corridos', 30, '30 dias'),
  ('TRT',          'sem_prazo', NULL, '30 dias após NF',                           'dias_corridos', 60, '60 dias',  'dias_uteis', 5, '5 dias úteis',          'dias_corridos', 30, '30 dias'),
  ('TST',          'dia_mes_seguinte', 20, '20º dia do mês subsequente',           'dias_corridos', 60, '60 dias',  'sem_prazo', NULL, 'sem prazo definido',   'sem_prazo', NULL, 'sem prazo definido')
ON CONFLICT (convenio) DO NOTHING;

-- ─── Carga inicial: vínculo por semelhança de nome ───────────────────────────
-- Candidatas: as fontes pagadoras espelhadas em `operadoras` (aplis_id numérico
-- = fatinstituicao.IdInstituicao; clínicas parceiras de fora) e as que já
-- estão na foto. O nome é comparado em maiúsculas e sem acento contra um
-- padrão por convênio. O que não casar fica sem vínculo, e a tela lista as
-- fontes com glosa sem regra para a responsável ligar. Só roda com o vínculo
-- vazio: reaplicar a migration não religa uma fonte desligada na tela.
WITH candidatas AS (
  SELECT DISTINCT ON (id) id, nome
  FROM (
    SELECT aplis_id::INTEGER AS id, nome, 1 AS prioridade
    FROM public.operadoras
    WHERE aplis_id ~ '^\d+$' AND NOT COALESCE(is_clinica_parceira, FALSE)
    UNION ALL
    SELECT id_fonte_pagadora, fonte_pagadora_nome, 2
    FROM public.glosa_recurso_requisicoes
    WHERE id_fonte_pagadora IS NOT NULL AND fonte_pagadora_nome IS NOT NULL
  ) c
  ORDER BY id, prioridade
),
normalizadas AS (
  SELECT id, nome,
         translate(upper(nome), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') AS chave
  FROM candidatas
),
padroes (convenio, padrao) AS (VALUES
  ('ASSEFAZ',      '^ASSEFAZ'),
  ('AMIL',         '^AMIL\M'),
  ('AMHP',         '^AMHP'),
  ('AMPLA',        '^AMPLA\M'),
  ('BRADESCO',     '\mBRADESCO\M'),
  ('BRB',          '^BRB\M'),
  ('CAMARA',       '^CAMARA DOS DEPUTADOS'),
  ('CASSI',        '^CASSI\M'),
  ('CBMDF',        '^CBMDF'),
  ('E-VIDA',       '^E-VIDA'),
  ('FASCAL',       '^FASCAL'),
  ('FUSEX',        '^FUSEX'),
  ('GAMA',         '^GAMA SAUDE'),
  ('GEAP',         '^GEAP\M'),
  ('INAS',         '^INAS\M'),
  ('PF',           '^POLICIA FEDERAL'),
  ('PLAN ASSISTE', '\mPLAN ?ASSISTE'),
  ('PMDF',         '^PMDF'),
  ('POSTAL SAÚDE', '^POSTAL SAUDE'),
  ('SAÚDE CAIXA',  '^SAUDE CAIXA'),
  ('SELECT',       '^SELECT\M'),
  ('SIS SENADO',   '^SIS SENADO'),
  ('STF-MED',      '^STF\M'),
  ('STM',          '^STM\M'),
  ('STJ',          '^STJ\M'),
  ('SUL AMERICA',  '\mSUL ?AMERICA'),
  ('TJDFT',        '^TJDFT'),
  ('TRE',          '^TRE\M'),
  ('TRT',          '^TRT\M'),
  ('TST',          '^TST\M')
)
INSERT INTO public.glosa_prazo_regra_fontes (id_fonte_pagadora, regra_id, fonte_pagadora_nome)
SELECT n.id, r.id, n.nome
FROM normalizadas n
JOIN padroes p ON n.chave ~ p.padrao
JOIN public.glosa_prazo_regras r ON r.convenio = p.convenio
WHERE NOT EXISTS (SELECT 1 FROM public.glosa_prazo_regra_fontes)
ON CONFLICT (id_fonte_pagadora) DO NOTHING;
