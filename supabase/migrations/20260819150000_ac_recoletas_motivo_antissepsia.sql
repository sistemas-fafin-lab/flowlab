-- ═══════════════════════════════════════════════════════════════════════════════
-- Recoletas — novo motivo: "Provável falha de antissepsia"
--
-- Amplia o CHECK de ac_recoletas.motivo para aceitar 'falha_antissepsia'
-- (superset dos valores já em uso — nenhum fluxo atual muda). Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Remove o CHECK atual do motivo, localizado pela definição ('hemolise' só
-- aparece nele — o outro CHECK da tabela é o de status), em vez de confiar no
-- nome automático (ac_recoletas_motivo_check, com possível sufixo numérico).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.ac_recoletas'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%hemolise%'
  LOOP
    EXECUTE format('ALTER TABLE public.ac_recoletas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE ac_recoletas
  ADD CONSTRAINT ac_recoletas_motivo_check
  CHECK (motivo IN (
    'hemolise','estabilidade','recipiente_inadequado',
    'amostra_insuficiente','confirmacao_resultados','amostra_extraviada',
    'falha_antissepsia'));
