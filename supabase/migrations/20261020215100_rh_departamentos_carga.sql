-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — Departamentos: carga inicial
-- Migration: 20261020215100_rh_departamentos_carga.sql
-- (.scratch/solicitacoes-aprovacao-gestor/issues/06-departamentos-no-rh.md)
--
-- Roda depois de 20261020215000_rh_departamentos.sql (tabelas) e antes de
-- 20261020220000_sc_aprovador_pelo_departamento.sql, que calcula o aprovador
-- das SCs pendentes a partir do que esta carga preenche.
--
-- Mapeamento aprovado pelo usuário em 2026-10-20, a partir do levantamento de
-- produção de colaboradores.departamento (55 ativos, 14 valores): um
-- departamento por texto, mesmo nome. "testando" (Transporte) fica sem
-- departamento, como pendência na aba.
--
-- Aprovadores e responsáveis: só o que foi decidido. Departamentos em que a
-- lista de gestores do RH cobria só parte das pessoas ficam vazios e o RH
-- preenche na aba (até lá, as SCs deles ficam com o admin).
--   Área técnica      → aprovador Paulo Vítor
--   Qualidade         → aprovador Paulo Vítor (departamento da Eduarda)
--   Financeiro        → aprovador e responsável Louise Fontel
--   Faturamento       → responsável Louise Fontel (departamento da Raquel)
--   RH                → aprovador e responsável Suane
--   Copa/Limpeza      → aprovador e responsável Suane
--   Biologia Molecular, Atendimento, Comercial, Diretoria, Equipe Médica,
--   Estoque, TI, Transporte → vazios
--
-- As pessoas são casadas pelo nome cadastrado (os IDs diferem entre teste e
-- produção, ver 20260921100000); falha se não houver exatamente um.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Departamentos
-- ----------------------------------------------------------------------------
INSERT INTO public.departamentos (nome)
VALUES
  ('Área técnica'),
  ('Atendimento'),
  ('Biologia Molecular'),
  ('Comercial'),
  ('Copa/Limpeza'),
  ('Diretoria'),
  ('Equipe Médica'),
  ('Estoque'),
  ('Faturamento'),
  ('Financeiro'),
  ('Qualidade'),
  ('RH'),
  ('TI'),
  ('Transporte')
ON CONFLICT (lower(btrim(nome))) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2) departamento_id pelo texto atual. Não sobrescreve o que o RH já tiver
--    definido pela aba.
-- ----------------------------------------------------------------------------
UPDATE public.colaboradores c
   SET departamento_id = d.id
  FROM public.departamentos d
 WHERE lower(btrim(c.departamento)) = lower(btrim(d.nome))
   AND c.departamento_id IS NULL
   AND btrim(c.nome) <> 'testando';

-- ----------------------------------------------------------------------------
-- 3) Aprovadores e responsáveis
-- ----------------------------------------------------------------------------
-- Único colaborador com esse nome; falha alto em vez de rodar sem efeito.
CREATE OR REPLACE FUNCTION pg_temp.colaborador_pelo_nome(p_nome text)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_ids
    FROM public.colaboradores
   WHERE btrim(nome) = p_nome;
  IF coalesce(array_length(v_ids, 1), 0) <> 1 THEN
    RAISE EXCEPTION 'Esperado exatamente 1 colaborador com o nome "%", encontrado(s) %.',
      p_nome, coalesce(array_length(v_ids, 1), 0);
  END IF;
  RETURN v_ids[1];
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.departamento_pelo_nome(p_nome text)
RETURNS uuid
LANGUAGE sql
AS $$
  SELECT id FROM public.departamentos WHERE lower(btrim(nome)) = lower(p_nome);
$$;

-- Aprovador de SC: só onde ainda está vazio.
UPDATE public.departamentos d
   SET aprovador_sc_id = a.colaborador_id
  FROM (VALUES
    ('Área técnica', pg_temp.colaborador_pelo_nome('Paulo Vítor')),
    ('Qualidade',    pg_temp.colaborador_pelo_nome('Paulo Vítor')),
    ('Financeiro',   pg_temp.colaborador_pelo_nome('Louise Fontel')),
    ('RH',           pg_temp.colaborador_pelo_nome('Suane Batista De Oliveira')),
    ('Copa/Limpeza', pg_temp.colaborador_pelo_nome('Suane Batista De Oliveira'))
  ) AS a(departamento, colaborador_id)
 WHERE d.id = pg_temp.departamento_pelo_nome(a.departamento)
   AND d.aprovador_sc_id IS NULL;

INSERT INTO public.departamento_responsaveis (departamento_id, colaborador_id)
VALUES
  (pg_temp.departamento_pelo_nome('Financeiro'),   pg_temp.colaborador_pelo_nome('Louise Fontel')),
  (pg_temp.departamento_pelo_nome('Faturamento'),  pg_temp.colaborador_pelo_nome('Louise Fontel')),
  (pg_temp.departamento_pelo_nome('RH'),           pg_temp.colaborador_pelo_nome('Suane Batista De Oliveira')),
  (pg_temp.departamento_pelo_nome('Copa/Limpeza'), pg_temp.colaborador_pelo_nome('Suane Batista De Oliveira'))
ON CONFLICT DO NOTHING;

COMMIT;
