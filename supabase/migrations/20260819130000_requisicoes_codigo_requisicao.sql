-- ═══════════════════════════════════════════════════════════════════════════════
-- requisicoes.codigo_requisicao — CodRequisicao do apLIS
-- Migration: 20260819130000_requisicoes_codigo_requisicao.sql
--
-- fat_criar_titulo já recebe req.codRequisicao do handler (só usado hoje como
-- fallback de numero_guia) mas nunca o persistia como campo próprio. Sem ele, o
-- operador não consegue ir do título até a requisição no apLIS sem abrir outro
-- sistema. NULLABLE: títulos criados antes desta migration não têm o dado — a
-- UI mostra "indisponível" em vez de quebrar.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE requisicoes ADD COLUMN IF NOT EXISTS codigo_requisicao TEXT;

COMMENT ON COLUMN requisicoes.codigo_requisicao IS 'CodRequisicao do apLIS — identifica a requisição no sistema de origem, independente de ter guia de convênio. NULL em títulos criados antes desta coluna existir.';
