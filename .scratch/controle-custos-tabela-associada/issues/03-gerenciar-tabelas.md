# 03: Gerenciar tabelas — renomear, desativar, excluir e proteção da Particular

**What to build:** No bloco "Tabelas desta fonte", o usuário renomeia uma tabela (todas as linhas dela passam a mostrar o novo nome), desativa uma tabela que não usa mais (ela some das listas de escolha, mas as linhas continuam valendo) e exclui uma tabela sem linhas. A tabela Particular da fonte Particular não pode ser renomeada, desativada nem excluída. Ver spec: `../spec.md`.

**Blocked by:** 02 — Escolha de tabela associada por lista, com "+ Nova tabela"

**Status:** ready-for-agent

- [ ] Renomear atualiza o nome exibido em todas as linhas da tabela (e o texto sincronizado); nome repetido na fonte é recusado.
- [ ] Desativar/reativar; tabela inativa some das listas de escolha (importação, modal de linha) e não recebe linhas novas; linhas existentes continuam na tela e no orçamento.
- [ ] Excluir só é permitido sem linhas — garantido no banco (FK restritiva) e com mensagem clara na tela.
- [ ] Particular/Particular protegida contra renomear, desativar e excluir no banco e na tela (ações escondidas ou desabilitadas com explicação).
