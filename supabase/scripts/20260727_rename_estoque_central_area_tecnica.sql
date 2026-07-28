-- ─────────────────────────────────────────────────────────────────────────────
-- Renomear o estoque central "Qualidade" → "Área técnica"
-- Data: 2026-07-27
--
-- Contexto: o estoque central que distribui para os postos (clínicas) era o
-- setor "Qualidade" (stock_locations com nome='Qualidade', department='Qualidade',
-- posto_id IS NULL). Quem cuida do estoque das clínicas passou a ser a Área
-- técnica, então o central foi renomeado para "Área técnica".
--
-- Além do rótulo, o ACESSO ao central + estoque dos postos deixou de ser por
-- departamento (antes: quem era do dept 'Qualidade') e passou a ser pela
-- permissão canManageStockPostos, concedida via custom role. Este script mexe
-- APENAS nos dados do setor central; a permissão/cargo é configurada na UI
-- (Gerenciar Cargos) e atribuída aos usuários da área técnica.
--
-- Só a linha central tem nome='Qualidade' com posto_id IS NULL — os postos usam
-- nome 'Posto — <x>'. IDEMPOTENTE: se já for 'Área técnica', não faz nada; se já
-- existir um local 'Área técnica', não renomeia (evita violar uq_stock_locations_nome).
-- REVISAR antes de rodar. Rodar no projeto alvo (test/prod, pooler IPv4).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE stock_locations
   SET nome       = 'Área técnica',
       department = 'Área técnica',
       updated_at = now()
 WHERE nome = 'Qualidade'
   AND posto_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM stock_locations x WHERE x.nome = 'Área técnica');

COMMIT;

-- Verificação — o central deve aparecer como 'Área técnica' (posto_id NULL, consumo ON):
SELECT nome, department, ativo, rastreavel, controla_consumo, posto_id
  FROM stock_locations
 ORDER BY controla_consumo DESC, posto_id NULLS LAST, nome;
