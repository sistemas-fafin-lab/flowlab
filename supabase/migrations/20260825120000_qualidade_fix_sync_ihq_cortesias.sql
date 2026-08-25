-- ============================================================================
-- Corrige o UNIQUE de qa_ihq_solicitacoes usado pelo upsert de sync-ihq.
--
-- Reportado pelo usuário: POST /api/qualidade/sync-cortesias devolvendo 500
-- em produção, e os 3 submódulos com heurística (IHQ/Cortesias/Câncer, ao
-- contrário de Ocorrências) com os KPIs vazios no painel.
--
-- Causa raiz (achada lendo qualidade-sync-cortesias.ts e
-- qualidade-sync-ihq.ts contra o schema de 20260820120000_qualidade_piloto):
--
-- 1. `qa_cortesias.id_requisicao_lis` e `qa_ihq_solicitacoes.id_requisicao_ihq`
--    são NOT NULL, mas nem `bdLabQualidade.ts` buscava esse campo no LIS nem
--    os handlers de sync o incluíam no payload do upsert — todo INSERT
--    falhava com violação de NOT NULL. Corrigido no código
--    (api/_lib/qualidade/bdLabQualidade.ts + handlers), não é assunto desta
--    migration.
-- 2. `qualidade-sync-ihq.ts` faz `upsert(..., { onConflict:
--    'cod_requisicao_ihq' })`, mas a única UNIQUE que existia em
--    qa_ihq_solicitacoes era composta `(id_requisicao_ihq, id_tarefa_bloco)`
--    — Postgres rejeita um ON CONFLICT sem constraint exata correspondente.
--    `id_tarefa_bloco` também nunca é preenchido por este sync (fica NULL),
--    e NULL nunca colide consigo mesmo numa UNIQUE constraint — mesmo se o
--    onConflict apontasse para a composta, cada sync duplicaria a linha em
--    vez de atualizar. `cod_requisicao_ihq` é, na prática, a chave natural
--    da solicitação para o que o sync sincroniza hoje.
-- ============================================================================

ALTER TABLE qa_ihq_solicitacoes
  ADD CONSTRAINT qa_ihq_solicitacoes_cod_requisicao_ihq_key UNIQUE (cod_requisicao_ihq);
