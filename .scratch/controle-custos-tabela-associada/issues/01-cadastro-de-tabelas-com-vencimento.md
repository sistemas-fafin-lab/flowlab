# 01: Cadastro de tabelas associadas, com vencimento

**What to build:** A tabela associada passa a existir como cadastro ligado à fonte pagadora. Todas as combinações (fonte, tabela) existentes viram cadastros com a grafia exata — nada é unificado aqui. Com uma fonte selecionada, a tela de Fontes Pagadoras mostra o bloco "Tabelas desta fonte", onde o usuário vê cada tabela, edita o vencimento do contrato, vê o selo (vencida / vence em até 30 dias) e filtra os contratos a vencer. Primeiro passo de um expand–contract: o texto da tabela nas linhas continua existindo e sincronizado. Ver spec: `../spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Nova tabela `custo_tabelas_associadas` (fonte_pagadora texto, nome, vencimento opcional, ativa padrão true, timestamps), com RLS igual à de `custo_fontes_pagadoras`.
- [x] Unicidade provisória por (fonte, nome) com grafia exata — a versão sem diferenciar maiúsculas fica para o ticket 07, depois da unificação.
- [x] Migração cria um cadastro por (fonte, tabela texto) existente e preenche `tabela_associada_id` em todas as linhas de `custo_fontes_pagadoras`.
- [x] Gravações existentes (modal de linha, importação) continuam funcionando e mantêm `tabela_associada_id` coerente com o texto (criando o cadastro se o texto for novo).
- [x] Função pura `situacaoVencimento(vencimento, hoje)` → vencida | a_vencer (até 30 dias) | em_dia | sem_vencimento, com testes (sem data, ontem, hoje, +30, +31).
- [x] Bloco "Tabelas desta fonte" lista as tabelas da fonte selecionada com vencimento e selo, permite editar o vencimento e filtrar vencidas/a vencer.
- [x] Nenhuma mudança de comportamento na tela de linhas nem no orçamento.

## Comments

- Implementado em `20261021170000_custo_tabelas_associadas.sql` + bloco `TabelasDaFonte`. A sincronia texto → id fica num trigger (`custo_fontes_pagadoras_sincroniza_tabela_associada`), então modal, importação e scripts não mudaram; o ticket 02 precisa inverter o sentido (id → texto).
- Migração conferida num Postgres local com o backup de 2026-10-21: 4646 linhas, 86 cadastros (= 86 pares), 0 linhas sem id, idempotente. Aceita nome vazio porque a fonte Particular tem linhas com tabela `''`.
- Falta conferir no navegador depois de aplicar a migração no Supabase. Aplicar a migração antes de publicar o front.
