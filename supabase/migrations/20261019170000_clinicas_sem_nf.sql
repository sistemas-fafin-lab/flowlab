-- ═══════════════════════════════════════════════════════════════════════════════
-- Faturamento — Clínicas sem NF (locais de origem que não emitem nota)
-- Migration: 20261019170000_clinicas_sem_nf.sql
--
-- Pendências → Particulares mostrava, misturadas com a pendência real, as
-- requisições de clínicas para as quais o laboratório nunca emite NF. "Clínica"
-- aqui é o LOCAL DE ORIGEM da requisição no apLIS (requisicao.IdLocalOrigem →
-- fatinstituicao), não a fonte pagadora: todas essas requisições são da fonte
-- 1102 PARTICULAR.
--
-- O handler de Particulares (api/_lib/faturamento/clinicasSemNf.ts) lê esta
-- lista com o cliente do usuário e passa os ids para a consulta do MySQL, que
-- tira essas requisições da lista e do total (a não ser com incluirSemNf=1).
--
-- Mesmo gate de custo_fontes_pagadoras (20260904110000): leitura para
-- canViewBilling ou canManageBilling, escrita só para canManageBilling.
-- Spec: .scratch/faturamento-pendencias-e-refechamento/spec.md
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

CREATE TABLE IF NOT EXISTS public.clinicas_sem_nf (
  aplis_id     INTEGER PRIMARY KEY,
  nome         TEXT NOT NULL CHECK (btrim(nome) <> ''),
  marcado_por  UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  marcado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.clinicas_sem_nf IS 'Locais de origem do apLIS para os quais o laboratório não emite NF. Suas requisições saem de Pendências → Particulares.';
COMMENT ON COLUMN public.clinicas_sem_nf.aplis_id IS 'fatinstituicao.IdInstituicao no apLIS, casado com requisicao.IdLocalOrigem.';
COMMENT ON COLUMN public.clinicas_sem_nf.nome IS 'Nome exibido (fatinstituicao.NomFantasia no momento da marcação).';
COMMENT ON COLUMN public.clinicas_sem_nf.marcado_por IS 'Quem marcou; NULL na semente desta migration.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. RLS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.clinicas_sem_nf ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinicas_sem_nf_select_billing ON public.clinicas_sem_nf;
CREATE POLICY clinicas_sem_nf_select_billing ON public.clinicas_sem_nf
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewBilling')
      OR public.current_user_has_permission('canManageBilling'));

DROP POLICY IF EXISTS clinicas_sem_nf_write_billing ON public.clinicas_sem_nf;
CREATE POLICY clinicas_sem_nf_write_billing ON public.clinicas_sem_nf
  FOR ALL TO authenticated
  USING (public.current_user_has_permission('canManageBilling'))
  WITH CHECK (public.current_user_has_permission('canManageBilling'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. SEMENTE — conferida em fatinstituicao no banco real (19/10/2026).
-- Os médicos com razão social "Mater Sul" ficam de fora de propósito: não são
-- o local de origem Mater Clínica (1014).
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.clinicas_sem_nf (aplis_id, nome, marcado_por) VALUES
  (1155, 'ABAC', NULL),
  (1290, 'NEXUS', NULL),
  (1014, 'MATER CLINICA', NULL),
  (1222, 'ECOMED', NULL)
ON CONFLICT (aplis_id) DO NOTHING;
