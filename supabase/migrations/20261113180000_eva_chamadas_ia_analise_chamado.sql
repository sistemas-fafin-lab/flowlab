-- 20261113180000_eva_chamadas_ia_analise_chamado.sql
-- A EVA analisa o pedido de cada chamado novo do LAB-BRAIN e propõe como ele entra no
-- Kanban (api/_lib/labBrainSugestao.ts). Cada tentativa de IA dessa análise vai para o
-- registro de chamadas que já existe, com a finalidade nova `analise_chamado`.
-- Spec: .scratch/lab-brain-aprovacao-eva/spec.md; issue 04-eva-analisa-com-ia.md.

BEGIN;

ALTER TABLE public.ti_agente_chamadas_ia
  DROP CONSTRAINT IF EXISTS ti_agente_chamadas_ia_finalidade_check;

ALTER TABLE public.ti_agente_chamadas_ia
  ADD CONSTRAINT ti_agente_chamadas_ia_finalidade_check
  CHECK (finalidade IN ('analise_reuniao', 'resposta_whatsapp', 'chat', 'analise_chamado'));

COMMENT ON COLUMN public.ti_agente_chamadas_ia.finalidade IS 'analise_reuniao, resposta_whatsapp, chat ou analise_chamado (a análise do pedido de um chamado do LAB-BRAIN).';

COMMIT;
