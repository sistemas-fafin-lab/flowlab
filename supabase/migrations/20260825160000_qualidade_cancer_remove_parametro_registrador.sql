-- ============================================================================
-- Remove `cancer.registrador` de qa_parametros — issue 13.
--
-- Causa raiz: `Registrador` (coluna 29 do RHC) foi modelado como parâmetro
-- fixo institucional junto com CNES/Cor/Fonte etc., mas no design original
-- (projeto irmão Flowlab_Controle_Qualidade) é quem preencheu aquele lote
-- específico, informado a cada exportação — pode mudar a cada
-- trimestre, diferente de um valor fixo da instituição.
--
-- Na prática o handler `gerar-exportacao-cancer` já exigia `registrador`
-- explícito no corpo da requisição e nunca lia essa linha; ela só criava uma
-- segunda superfície de edição (drawer do caso) para um valor que não tinha
-- efeito nenhum na exportação final. Removida a chave de
-- CHAVES_PARAMETRO_FIXO_CANCER (types.ts) e do drawer — esta migration
-- limpa a linha órfã que sobraria em produção.
-- ============================================================================

DELETE FROM qa_parametros WHERE chave = 'cancer.registrador';
