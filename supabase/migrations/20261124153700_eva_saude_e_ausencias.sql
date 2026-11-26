-- EVA — saúde das integrações e ausências da equipe (D39, D40; issues 28 e 29).
--
-- 1. ti_agente_saude: um problema por linha (Granola com erro ou parado, VPS sem sinal, sessão do
--    WhatsApp desconectada, IA sem responder). Quem configura a EVA é avisado quando o problema
--    aparece, de novo a cada 24 h enquanto continuar, e quando ele se resolve. Só o servidor grava
--    (service role); quem configura lê.
-- 2. ti_agente_membros: a ausência de cada pessoa (férias, licença, folga), marcada na aba Membros
--    ou pelo WhatsApp. No período, a pessoa não recebe cobrança e sai da conta de sobrecarga do
--    relatório de gestão, que avisa dos cards dela que vencem nesse tempo.
--
-- Idempotente.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. SAÚDE DAS INTEGRAÇÕES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ti_agente_saude (
  chave         text PRIMARY KEY,
  ativo         boolean NOT NULL DEFAULT true,
  texto         text NOT NULL,
  desde         timestamptz NOT NULL DEFAULT now(),
  avisado_em    timestamptz,
  resolvido_em  timestamptz
);

COMMENT ON TABLE public.ti_agente_saude IS
  'Problemas das integrações da EVA (D39): granola_erro, granola_parou, waha_sem_sinal, waha_desconectado, ia_fora. ativo = acontecendo agora; o aviso a quem configura sai na abertura, a cada 24 h e na resolução.';

ALTER TABLE public.ti_agente_saude ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_agente_saude_select ON public.ti_agente_saude;
CREATE POLICY ti_agente_saude_select ON public.ti_agente_saude
  FOR SELECT TO authenticated
  USING (public.ti_agente_pode('canConfigureAgenteTI'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. AUSÊNCIAS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.ti_agente_membros
  ADD COLUMN IF NOT EXISTS ausente_de      date,
  ADD COLUMN IF NOT EXISTS ausente_ate     date,
  ADD COLUMN IF NOT EXISTS ausencia_motivo text;

ALTER TABLE public.ti_agente_membros DROP CONSTRAINT IF EXISTS ti_agente_membros_ausencia_check;
ALTER TABLE public.ti_agente_membros ADD CONSTRAINT ti_agente_membros_ausencia_check
  CHECK (ausente_de IS NULL OR ausente_ate IS NULL OR ausente_ate >= ausente_de);

COMMENT ON COLUMN public.ti_agente_membros.ausente_de IS 'Início da ausência (D40); null com ausente_ate preenchido = desde já.';
COMMENT ON COLUMN public.ti_agente_membros.ausente_ate IS 'Último dia da ausência (D40), incluso. null = sem ausência marcada.';
COMMENT ON COLUMN public.ti_agente_membros.ausencia_motivo IS 'Férias, licença, folga… Aparece no relatório e na aba Membros.';
