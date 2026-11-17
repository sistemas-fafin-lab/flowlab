-- ═══════════════════════════════════════════════════════════════════════════════
-- Calendário de envios: remove fat_envio_agendamentos.lote_aplis_confirmado.
--
-- Substituída por lotes_aplis em 20261117150000 e mantida só até o deploy da API que
-- lê lotes_aplis (no ar desde 17/11/2026). Nem o trigger de histórico nem
-- fat_envio_confirmar_aplis a leem mais. O índice único dela
-- (fat_envio_agendamentos_lote_aplis_idx) sai junto. As linhas antigas do histórico
-- continuam com {"lote_aplis_confirmado": n} no JSON; a tela lê esse formato.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'fat_envio_agendamentos' AND column_name = 'lotes_aplis'
  ) THEN
    RAISE EXCEPTION 'Coluna lotes_aplis não existe. Aplique 20261117150000_fat_envio_varios_lotes.sql antes desta migration.';
  END IF;
END $$;

DROP INDEX IF EXISTS public.fat_envio_agendamentos_lote_aplis_idx;
ALTER TABLE public.fat_envio_agendamentos DROP COLUMN IF EXISTS lote_aplis_confirmado;
