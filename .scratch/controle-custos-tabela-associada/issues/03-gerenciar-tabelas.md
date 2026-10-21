# 03: Gerenciar tabelas — renomear, desativar, excluir e proteção da Particular

**What to build:** No bloco "Tabelas desta fonte", o usuário renomeia uma tabela (todas as linhas dela passam a mostrar o novo nome), desativa uma tabela que não usa mais (ela some das listas de escolha, mas as linhas continuam valendo) e exclui uma tabela sem linhas. A tabela Particular da fonte Particular não pode ser renomeada, desativada nem excluída. Ver spec: `../spec.md`.

**Blocked by:** 02 — Escolha de tabela associada por lista, com "+ Nova tabela"

**Status:** ready-for-agent

- [x] Renomear atualiza o nome exibido em todas as linhas da tabela (e o texto sincronizado); nome repetido na fonte é recusado.
- [x] Desativar/reativar; tabela inativa some das listas de escolha (importação, modal de linha) e não recebe linhas novas; linhas existentes continuam na tela e no orçamento.
- [x] Excluir só é permitido sem linhas — garantido no banco (FK restritiva) e com mensagem clara na tela.
- [x] Particular/Particular protegida contra renomear, desativar e excluir no banco e na tela (ações escondidas ou desabilitadas com explicação).

## Comments

- Implementado em `20261021190000_custo_tabelas_associadas_gerenciar.sql` + ações no bloco `TabelasDaFonte` (renomear no lugar, desativar/reativar, excluir) + `useCostControl` (`renameTabelaAssociada`, `setAtivaTabelaAssociada`, `deleteTabelaAssociada`). Domínio em `domain/tabelasAssociadas.ts` com testes: `tabelaProtegida`, `erroNomeTabela` (antes `erroNomeNovaTabela`, agora ignora a própria tabela no renomear) e `contarLinhasPorTabela`.
- Regras no banco: renomear propaga o nome para o texto das linhas (trigger AFTER UPDATE OF nome, que passa pelo caminho texto → id do trigger das linhas: se esse caminho for removido no ticket 07, a propagação precisa gravar o id junto); no renomear, nome em branco ou repetido na fonte sem diferenciar maiúsculas é recusado (para inserts a unicidade continua exata até o 07); tabela não troca de fonte; inativa recusa insert e linha movida para ela, mas aceita edição das linhas que já tem; excluir com linhas é barrado pela FK restritiva (23503 vira mensagem clara na tela).
- Proteção da Tabela Particular: fonte "Particular" + nome "particular" sem diferenciar maiúsculas, o mesmo critério de `api/_lib/orcamentoParticular.ts`. Por isso "PARTICULAR" também fica protegida enquanto alimenta o orçamento. Na tela, as ações somem e aparecem o cadeado e "protegida", com a explicação no title. A obrigação que isso cria para o ticket 06 está anotada lá.
- Pendências do 02: a tabela vazia que sobra quando o usuário cancela depois de "+ Nova tabela" agora se exclui pelo bloco (não há limpeza automática, de propósito). O "separa da linha geral" numa tabela inativa é barrado no modal e no banco.
- Conferido num Postgres local (migrações 170000 → 180000 → 190000, reaplicável) em 12 cenários: renomear e propagar, nome repetido, nome vazio, troca de fonte, Particular/PARTICULAR protegidas, vencimento da Particular editável, inativa recusando insert por id, por texto e linha movida, edição de preço em tabela inativa, excluir com linhas e sem linhas, reativar.
- Falta conferir no navegador. Aplicar a migração antes de publicar o front.
