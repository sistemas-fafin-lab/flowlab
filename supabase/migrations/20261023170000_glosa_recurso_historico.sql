-- ═══════════════════════════════════════════════════════════════════════════════
-- Glosas e Recursos — histórico das requisições e dos lotes de recurso
-- Migration: 20261023170000_glosa_recurso_historico.sql
--
-- Issue 06 de .scratch/glosas-recursos-dashboard/. O apLIS não registra as
-- mudanças de status da requisição de forma útil; o histórico é do FlowLab.
-- Cada sincronização (/api/faturamento/glosas-recursos-sincronizar) compara a
-- foto anterior com a nova e grava os eventos (regras em
-- api/_lib/faturamento/recursoGlosa.ts: eventosDaRequisicao, eventosDoLote).
-- A primeira sincronização de uma requisição grava só "início do
-- acompanhamento": o passado não é reconstruído.
--
-- Sem chave estrangeira para a foto: os eventos são gravados antes dela (uma
-- falha no meio repete eventos na próxima sincronização em vez de perdê-los),
-- e o histórico sobrevive à foto.
--
-- RLS no padrão do faturamento (20260807120000): lê quem vê o faturamento,
-- grava quem gerencia (edições manuais, ticket 07). Sem UPDATE nem DELETE: é
-- registro de auditoria. A sincronização grava com service_role.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.glosa_recurso_historico (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Evento da requisição: id_requisicao preenchido (id_lote_recurso é o lote
  -- dela naquele momento). Evento do lote: só id_lote_recurso.
  id_requisicao   INTEGER,
  id_lote_recurso INTEGER,
  ocorrido_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo            TEXT NOT NULL CHECK (tipo IN (
                    'inicio_acompanhamento',
                    'entrada_lote_recurso',
                    'mudanca_status',
                    'mudanca_recebido',
                    'envio_lote'
                  )),
  valor_anterior  TEXT,
  valor_novo      TEXT,
  descricao       TEXT NOT NULL,
  -- Preenchido nas edições manuais; null nos eventos da sincronização.
  usuario_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (id_requisicao IS NOT NULL OR id_lote_recurso IS NOT NULL)
);

COMMENT ON TABLE public.glosa_recurso_historico IS 'Histórico de glosas e recursos: eventos por requisição e por lote de recurso, gerados pela comparação entre fotos do apLIS e pelas edições manuais.';
COMMENT ON COLUMN public.glosa_recurso_historico.ocorrido_em IS 'Quando o FlowLab viu a mudança (a sincronização) ou quando a edição foi feita.';
COMMENT ON COLUMN public.glosa_recurso_historico.valor_anterior IS 'Status (código), lote, recebido (0.00) ou data de envio (YYYY-MM-DD) antes do evento.';
COMMENT ON COLUMN public.glosa_recurso_historico.descricao IS 'Texto legível do evento, como a aba Histórico mostra.';

CREATE INDEX IF NOT EXISTS glosa_recurso_historico_requisicao_idx
  ON public.glosa_recurso_historico (id_requisicao, ocorrido_em)
  WHERE id_requisicao IS NOT NULL;
CREATE INDEX IF NOT EXISTS glosa_recurso_historico_lote_idx
  ON public.glosa_recurso_historico (id_lote_recurso, ocorrido_em)
  WHERE id_requisicao IS NULL;

ALTER TABLE public.glosa_recurso_historico ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'glosa_recurso_historico'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.glosa_recurso_historico', p.policyname);
  END LOOP;
END $$;

CREATE POLICY glosa_recurso_historico_select_billing ON public.glosa_recurso_historico
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewBilling') OR public.current_user_has_permission('canManageBilling'));

CREATE POLICY glosa_recurso_historico_insert_billing ON public.glosa_recurso_historico
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageBilling'));
