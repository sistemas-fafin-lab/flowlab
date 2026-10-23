-- ═══════════════════════════════════════════════════════════════════════════════
-- Pagamentos: carga dos gestores que autorizam e dos aprovadores de SC
-- Migration: 20261023120100_departamentos_gestores_carga.sql
--
-- Roda logo depois de 20261023120000_departamentos_gestores_pagamentos.sql, no mesmo
-- deploy: sem gestor marcado, ninguém consegue pedir pagamento.
--
-- Lista enviada pelo usuário em 23/10/2026:
--
--   Departamento         Gestor que autoriza pagamentos   Aprovador de SC
--   Área técnica         Paulo Vítor                      Paulo Vítor
--   Atendimento          Louise Fontel                    Louise Fontel
--   Biologia Molecular   Paulo Vítor                      Paulo Vítor
--   Comercial            Cristiane Madeiro                Cristiane Madeiro
--   Copa/Limpeza         Suane Batista De Oliveira        Suane Batista De Oliveira
--   Diretoria            Mario Gorini                     Mario Gorini
--   Equipe Médica        Paulo Vítor                      Paulo Vítor
--   Estoque              Louise Fontel                    Louise Fontel
--   Faturamento          Raquel Dos Santos Avelino        Louise Fontel
--   Financeiro           Louise Fontel                    Louise Fontel
--   Qualidade            Eduarda Silva Fabri              Eduarda Silva Fabri (antes: Paulo Vítor)
--   RH                   Suane Batista De Oliveira        Suane Batista De Oliveira
--   TI                   Gabriel Queiroz de Souza         Gabriel Queiroz de Souza
--   Transporte           Lucas Moreira                    Louise Fontel
--
-- Decisões dele (23/10): a Qualidade passa a ter a Eduarda como aprovadora de SC; a
-- Louise continua responsável pelo Faturamento (holerites da equipe), sem autorizar os
-- pagamentos dele; a carga dá "Ser Autorizador de Pagamentos" aos cargos dos gestores.
--
-- O que faz:
--   1. Cada gestor da lista vira responsável do departamento (se ainda não era), marcado
--      autoriza_pagamentos. Responsáveis que já existiam e não estão na lista ficam como
--      estão, sem autorizar.
--   2. O aprovador de SC de cada departamento passa a ser o da lista. Os triggers de
--      20261020234000 gravam o novo aprovador nas SCs pendentes que estão sem aprovador, e
--      o aviso de 20261020235000 manda o e-mail; SC que já tem aprovador não muda (as da
--      Qualidade que já estão com o Paulo continuam com ele).
--   3. "Ser Autorizador de Pagamentos" nos cargos desses gestores. A permissão sozinha não
--      faz ninguém autorizar: só o gestor marcado do departamento autoriza.
--   4. Confere no fim: todo departamento ativo com gente tem gestor apto. Senão, aborta
--      e diz qual (gestor sem login, usuário inativo, sem cargo).
--
-- Pessoas e departamentos são casados pelo nome, sem diferenciar maiúsculas, acentos nem
-- espaços repetidos (a lista veio com "Louíse"). Aborta se não houver exatamente um
-- colaborador ativo com o nome, ou se o departamento não existir.
-- Antes de aplicar, dá para conferir com supabase/scripts/departamentos_gestores_previa.sql.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.departamento_autorizadores_pagamento(uuid, uuid[])') IS NULL THEN
    RAISE EXCEPTION 'Aplique antes 20261023120000_departamentos_gestores_pagamentos.sql.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.chave_nome(p_nome TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
           translate(lower(btrim(p_nome)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
           '\s+', ' ', 'g');
$$;

CREATE OR REPLACE FUNCTION pg_temp.colaborador_ativo(p_nome TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO v_ids
    FROM public.colaboradores
   WHERE status = 'ativo'
     AND pg_temp.chave_nome(nome) = pg_temp.chave_nome(p_nome);
  IF coalesce(array_length(v_ids, 1), 0) <> 1 THEN
    RAISE EXCEPTION 'Esperado exatamente 1 colaborador ativo com o nome "%", encontrado(s) %. Confira o nome no cadastro.',
      p_nome, coalesce(array_length(v_ids, 1), 0);
  END IF;
  RETURN v_ids[1];
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.departamento(p_nome TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.departamentos WHERE pg_temp.chave_nome(nome) = pg_temp.chave_nome(p_nome);
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Departamento "%" não encontrado.', p_nome;
  END IF;
  RETURN v_id;
END;
$$;

CREATE TEMP TABLE carga_gestores (departamento TEXT, gestor TEXT, aprovador TEXT) ON COMMIT DROP;
INSERT INTO carga_gestores (departamento, gestor, aprovador) VALUES
  ('Área técnica',       'Paulo Vítor',               'Paulo Vítor'),
  ('Atendimento',        'Louise Fontel',             'Louise Fontel'),
  ('Biologia Molecular', 'Paulo Vítor',               'Paulo Vítor'),
  ('Comercial',          'Cristiane Madeiro',         'Cristiane Madeiro'),
  ('Copa/Limpeza',       'Suane Batista De Oliveira', 'Suane Batista De Oliveira'),
  ('Diretoria',          'Mario Gorini',              'Mario Gorini'),
  ('Equipe Médica',      'Paulo Vítor',               'Paulo Vítor'),
  ('Estoque',            'Louise Fontel',             'Louise Fontel'),
  ('Faturamento',        'Raquel Dos Santos Avelino', 'Louise Fontel'),
  ('Financeiro',         'Louise Fontel',             'Louise Fontel'),
  ('Qualidade',          'Eduarda Silva Fabri',       'Eduarda Silva Fabri'),
  ('RH',                 'Suane Batista De Oliveira', 'Suane Batista De Oliveira'),
  ('TI',                 'Gabriel Queiroz de Souza',  'Gabriel Queiroz de Souza'),
  ('Transporte',         'Lucas Moreira',             'Louise Fontel');

-- ─── 1. Gestores que autorizam pagamentos ─────────────────────────────────────
INSERT INTO public.departamento_responsaveis (departamento_id, colaborador_id, autoriza_pagamentos)
SELECT pg_temp.departamento(departamento), pg_temp.colaborador_ativo(gestor), true
  FROM carga_gestores
ON CONFLICT (departamento_id, colaborador_id) DO UPDATE SET autoriza_pagamentos = true;

-- ─── 2. Aprovadores de SC ─────────────────────────────────────────────────────
UPDATE public.departamentos d
   SET aprovador_sc_id = x.aprovador_id
  FROM (SELECT pg_temp.departamento(departamento) AS departamento_id,
               pg_temp.colaborador_ativo(aprovador) AS aprovador_id
          FROM carga_gestores) x
 WHERE d.id = x.departamento_id
   AND d.aprovador_sc_id IS DISTINCT FROM x.aprovador_id;

-- ─── 3. Permissão nos cargos dos gestores ─────────────────────────────────────
UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canAuthorizePayments"]'::jsonb,
       updated_at = now()
 WHERE cr.id IN (
         SELECT p.custom_role_id
           FROM carga_gestores g
           JOIN public.colaboradores c ON c.id = pg_temp.colaborador_ativo(g.gestor)
           JOIN public.user_profiles p ON p.id = c.user_profile_id
          WHERE p.custom_role_id IS NOT NULL)
   AND NOT cr.permissions ? 'canAuthorizePayments';

-- ─── 4. Conferência: nenhum departamento com gente fica sem gestor apto ───────
DO $$
DECLARE
  v RECORD;
  v_problemas TEXT := '';
BEGIN
  FOR v IN
    SELECT d.nome,
           (SELECT count(*) FROM public.colaboradores m WHERE m.departamento_id = d.id AND m.status = 'ativo') AS pessoas
      FROM public.departamentos d
     WHERE d.ativo
       AND NOT EXISTS (SELECT 1 FROM public.departamento_autorizadores_pagamento(d.id))
     ORDER BY d.nome
  LOOP
    IF v.pessoas > 0 THEN
      v_problemas := v_problemas || format(E'\n  %s (%s pessoa(s))', v.nome, v.pessoas);
    ELSE
      RAISE NOTICE 'Departamento % está sem gestor que autorize pagamentos, mas não tem ninguém nele.', v.nome;
    END IF;
  END LOOP;
  IF v_problemas <> '' THEN
    RAISE EXCEPTION 'Departamentos com gente e sem gestor apto depois da carga (gestor sem login, usuário inativo ou sem cargo):%', v_problemas;
  END IF;
END $$;

COMMIT;
