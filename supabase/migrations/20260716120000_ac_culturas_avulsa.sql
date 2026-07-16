-- ═══════════════════════════════════════════════════════════════════════════════
-- Cultura avulsa — permitir acompanhamento sem vínculo com agendamento/coleta
--
-- Culturas (coprocultura, suabe, etc.) nem sempre passam pelo processo de coleta do
-- laboratório: algumas chegam já coletadas fora. Até aqui toda cultura nascia no
-- check-in (registrar_coleta) e exigia um agendamento (agendamento_id NOT NULL). Este
-- ALTER libera o cadastro AVULSO pela própria página de Culturas (botão "Nova cultura").
--
-- Efeitos colaterais: nenhum.
--   • RLS de INSERT já libera authenticated (ac_culturas_insert_auth WITH CHECK TRUE).
--   • UNIQUE(agendamento_id, exame_id): com agendamento_id NULL o Postgres trata cada
--     linha como distinta → várias culturas avulsas do mesmo exame são permitidas.
--   • FK ON DELETE RESTRICT com NULL é inócuo.
-- Idempotente: DROP NOT NULL em coluna já nullable é no-op.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE ac_culturas ALTER COLUMN agendamento_id DROP NOT NULL;

COMMENT ON COLUMN ac_culturas.agendamento_id IS
  'Agendamento de origem (check-in). NULL = cultura avulsa cadastrada manualmente.';
