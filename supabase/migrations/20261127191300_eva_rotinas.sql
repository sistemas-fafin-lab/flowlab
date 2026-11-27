-- EVA — rotinas que viram card sozinhas (D50, issue 36).
--
-- Backup mensal, revisão de acessos, troca de senha de serviço: o que não tem custo e por isso não
-- está no Gastos de TI. O gestor (ou quem configura a EVA) cadastra na aba Rotinas; alguns dias
-- antes de cada data, o relógio (D44) cria o card no Kanban e anda para a próxima data.
-- Os vencimentos de licenças e contratos (D49) não precisam de banco: vêm de ti_despesas.
--
-- 1. ti_agente_rotinas, com a data do próximo card (proxima_em) e o dia do mês da primeira data
--    (dia_ancora: o "todo dia 31" cai no último dia dos meses curtos e volta a 31 depois).
-- 2. RLS: lê quem vê a EVA; cadastra, edita e exclui o gestor e quem configura. O card, quem cria é
--    o servidor (service role).
--
-- Idempotente.

-- ── 1. A tabela ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ti_agente_rotinas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo             text NOT NULL CHECK (titulo = btrim(titulo) AND length(titulo) BETWEEN 1 AND 200),
  descricao          text,
  frequencia         text NOT NULL CHECK (frequencia IN ('semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  dia_ancora         smallint NOT NULL CHECK (dia_ancora BETWEEN 1 AND 31),
  proxima_em         date NOT NULL,
  antecedencia_dias  smallint NOT NULL DEFAULT 3 CHECK (antecedencia_dias BETWEEN 0 AND 60),
  responsaveis       uuid[] NOT NULL DEFAULT '{}'::uuid[],
  prioridade         text NOT NULL DEFAULT 'medium' CHECK (prioridade IN ('low', 'medium', 'high', 'critical')),
  projeto_id         uuid REFERENCES public.it_projects(id) ON DELETE SET NULL,
  ativa              boolean NOT NULL DEFAULT true,
  ultimo_card_id     uuid REFERENCES public.it_requests(id) ON DELETE SET NULL,
  ultima_criacao_em  timestamptz,
  ultimo_erro        text,
  created_by         uuid NOT NULL DEFAULT auth.uid() REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ti_agente_rotinas IS
  'D50: rotinas da TI sem custo (backup mensal, revisão de acessos). Alguns dias antes de proxima_em, o relógio da EVA cria o card e anda para a próxima data.';
COMMENT ON COLUMN public.ti_agente_rotinas.proxima_em IS 'O prazo do próximo card. O card é criado antecedencia_dias antes.';
COMMENT ON COLUMN public.ti_agente_rotinas.dia_ancora IS 'O dia do mês da primeira data, para as frequências em meses.';
COMMENT ON COLUMN public.ti_agente_rotinas.created_by IS 'Quem cadastrou: vira o solicitante dos cards.';

CREATE INDEX IF NOT EXISTS idx_ti_agente_rotinas_ativas ON public.ti_agente_rotinas (proxima_em) WHERE ativa;

-- ── 2. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.ti_agente_rotinas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_agente_rotinas_select ON public.ti_agente_rotinas;
CREATE POLICY ti_agente_rotinas_select ON public.ti_agente_rotinas
  FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_has_permission('canManageIT'))
    OR (SELECT public.ti_agente_pode('canManageAgenteTI'))
    OR (SELECT public.ti_agente_pode('canApproveAgenteTI'))
    OR (SELECT public.ti_agente_pode('canConfigureAgenteTI'))
  );

DROP POLICY IF EXISTS ti_agente_rotinas_insert ON public.ti_agente_rotinas;
CREATE POLICY ti_agente_rotinas_insert ON public.ti_agente_rotinas
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND ((SELECT public.ti_agente_pode('canManageAgenteTI')) OR (SELECT public.ti_agente_pode('canConfigureAgenteTI')))
  );

DROP POLICY IF EXISTS ti_agente_rotinas_update ON public.ti_agente_rotinas;
CREATE POLICY ti_agente_rotinas_update ON public.ti_agente_rotinas
  FOR UPDATE TO authenticated
  USING ((SELECT public.ti_agente_pode('canManageAgenteTI')) OR (SELECT public.ti_agente_pode('canConfigureAgenteTI')))
  WITH CHECK ((SELECT public.ti_agente_pode('canManageAgenteTI')) OR (SELECT public.ti_agente_pode('canConfigureAgenteTI')));

DROP POLICY IF EXISTS ti_agente_rotinas_delete ON public.ti_agente_rotinas;
CREATE POLICY ti_agente_rotinas_delete ON public.ti_agente_rotinas
  FOR DELETE TO authenticated
  USING ((SELECT public.ti_agente_pode('canManageAgenteTI')) OR (SELECT public.ti_agente_pode('canConfigureAgenteTI')));
