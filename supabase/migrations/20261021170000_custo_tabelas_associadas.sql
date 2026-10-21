-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — Tabela associada vira cadastro, com vencimento
-- Migration: 20261021170000_custo_tabelas_associadas.sql
--
-- Spec: .scratch/controle-custos-tabela-associada/spec.md (ticket 01).
--
-- A tabela associada (o contrato de preço de uma fonte pagadora — PROASA,
-- AFFEGO, cada campanha) era só o texto custo_fontes_pagadoras.tabela_associada.
-- Aqui ela ganha cadastro próprio, ligado à fonte pagadora (que continua
-- texto, sem cadastro), com vencimento opcional do contrato.
--
-- Primeiro passo de um expand–contract:
--   - um cadastro por (fonte, tabela texto) existente, com a grafia EXATA —
--     "Part", "PART" e "Particular" continuam três cadastros; a unificação é
--     o ticket 06, só com o mapa decidido pelo faturamento;
--   - o texto tabela_associada continua existindo e é ele que as gravações
--     atuais (modal de linha, importação, scripts) mandam. O trigger abaixo
--     acha (ou cria) o cadastro do texto e preenche tabela_associada_id, então
--     id e texto nunca divergem e nenhum gravador precisa mudar agora;
--   - unicidade por (fonte, nome) exata, provisória — a versão sem diferenciar
--     maiúsculas/espaços fica para o ticket 07, depois da unificação;
--   - nome vazio é aceito: em produção a fonte Particular tem linhas com
--     tabela_associada = '' (também resolvido na unificação).
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. TABELA
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.custo_tabelas_associadas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte_pagadora  TEXT NOT NULL CHECK (btrim(fonte_pagadora) <> ''),
  nome            TEXT NOT NULL,
  vencimento      DATE,
  ativa           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT custo_tabelas_associadas_fonte_nome_key UNIQUE (fonte_pagadora, nome)
);

COMMENT ON TABLE public.custo_tabelas_associadas IS 'Tabela associada (contrato de preço) de uma fonte pagadora. Cada linha de custo_fontes_pagadoras aponta para uma por tabela_associada_id.';
COMMENT ON COLUMN public.custo_tabelas_associadas.fonte_pagadora IS 'Mesmo texto de custo_fontes_pagadoras.fonte_pagadora — a fonte pagadora não tem cadastro próprio.';
COMMENT ON COLUMN public.custo_tabelas_associadas.vencimento IS 'Vencimento do contrato. Só aviso (selo/filtro na tela) — tabela vencida continua valendo.';
COMMENT ON COLUMN public.custo_tabelas_associadas.ativa IS 'Inativa some das listas de escolha; as linhas existentes continuam valendo.';

CREATE OR REPLACE FUNCTION public.custo_tabelas_associadas_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_custo_tabelas_associadas_updated_at ON public.custo_tabelas_associadas;
CREATE TRIGGER trigger_custo_tabelas_associadas_updated_at
  BEFORE UPDATE ON public.custo_tabelas_associadas
  FOR EACH ROW EXECUTE FUNCTION public.custo_tabelas_associadas_set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. RLS — mesmo gate de custo_fontes_pagadoras (20260904110000)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.custo_tabelas_associadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custo_tabelas_associadas_select_billing ON public.custo_tabelas_associadas;
CREATE POLICY custo_tabelas_associadas_select_billing ON public.custo_tabelas_associadas
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewBilling')
      OR public.current_user_has_permission('canManageBilling'));

DROP POLICY IF EXISTS custo_tabelas_associadas_write_billing ON public.custo_tabelas_associadas;
CREATE POLICY custo_tabelas_associadas_write_billing ON public.custo_tabelas_associadas
  FOR ALL TO authenticated
  USING (public.current_user_has_permission('canManageBilling'))
  WITH CHECK (public.current_user_has_permission('canManageBilling'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. CADASTROS A PARTIR DO TEXTO EXISTENTE + tabela_associada_id NAS LINHAS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.custo_tabelas_associadas (fonte_pagadora, nome)
SELECT DISTINCT fonte_pagadora, tabela_associada
FROM public.custo_fontes_pagadoras
ON CONFLICT (fonte_pagadora, nome) DO NOTHING;

ALTER TABLE public.custo_fontes_pagadoras
  ADD COLUMN IF NOT EXISTS tabela_associada_id UUID
    REFERENCES public.custo_tabelas_associadas (id) ON DELETE RESTRICT;

UPDATE public.custo_fontes_pagadoras f
SET tabela_associada_id = t.id
FROM public.custo_tabelas_associadas t
WHERE t.fonte_pagadora = f.fonte_pagadora
  AND t.nome = f.tabela_associada
  AND f.tabela_associada_id IS DISTINCT FROM t.id;

ALTER TABLE public.custo_fontes_pagadoras
  ALTER COLUMN tabela_associada_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_custo_fontes_pagadoras_tabela_associada_id
  ON public.custo_fontes_pagadoras (tabela_associada_id);

COMMENT ON COLUMN public.custo_fontes_pagadoras.tabela_associada_id IS 'Cadastro da tabela associada (custo_tabelas_associadas). Mantido coerente com o texto tabela_associada pelo trigger custo_fontes_pagadoras_sincroniza_tabela_associada.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. SINCRONIA texto → id em toda gravação de linha
--
-- Roda como o usuário (sem SECURITY DEFINER): quem grava linha já precisa de
-- canManageBilling, o mesmo gate de escrita do cadastro. ON CONFLICT DO
-- NOTHING + SELECT cobre duas gravações simultâneas criando a mesma tabela.
--
-- O texto manda: gravar só tabela_associada_id (sem o texto) é desfeito aqui.
-- O ticket 02, que passa a escolher a tabela por id, precisa inverter esse
-- sentido (id → texto) ao trocar os gravadores.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.custo_fontes_pagadoras_sincroniza_tabela_associada()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.custo_tabelas_associadas (fonte_pagadora, nome)
  VALUES (NEW.fonte_pagadora, NEW.tabela_associada)
  ON CONFLICT (fonte_pagadora, nome) DO NOTHING;

  SELECT id INTO NEW.tabela_associada_id
  FROM public.custo_tabelas_associadas
  WHERE fonte_pagadora = NEW.fonte_pagadora
    AND nome = NEW.tabela_associada;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_custo_fontes_pagadoras_sincroniza_tabela_associada ON public.custo_fontes_pagadoras;
CREATE TRIGGER trigger_custo_fontes_pagadoras_sincroniza_tabela_associada
  BEFORE INSERT OR UPDATE OF fonte_pagadora, tabela_associada, tabela_associada_id ON public.custo_fontes_pagadoras
  FOR EACH ROW EXECUTE FUNCTION public.custo_fontes_pagadoras_sincroniza_tabela_associada();
