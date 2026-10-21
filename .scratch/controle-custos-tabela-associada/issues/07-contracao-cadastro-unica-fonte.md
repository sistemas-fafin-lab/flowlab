# 07: Contração — cadastro de tabela associada como única fonte da verdade

**What to build:** Com as duplicadas unificadas e todo o código lendo pelo id, o banco passa a garantir as regras do cadastro: nome de tabela único por fonte sem diferenciar maiúsculas, toda linha com tabela cadastrada, e unicidade das linhas por tabela. O texto livre da tabela deixa de ser lido por qualquer código. Para o usuário, fica impossível voltar a nascer um "PART" ao lado de "Part". Ver spec: `../spec.md`.

**Blocked by:** 02 — Escolha por lista; 03 — Gerenciar tabelas; 04 — Tela, orçamento e exportação por id; 06 — Unificação das tabelas duplicadas

**Status:** ready-for-agent

- [ ] Unicidade de nome por fonte sem diferenciar maiúsculas/espaços nas pontas.
- [ ] `tabela_associada_id` obrigatório em `custo_fontes_pagadoras`.
- [ ] Unicidade por (tabela_associada_id, TUSS) para linhas gerais e (tabela_associada_id, exame) para linhas de exame, substituindo a unicidade por texto.
- [ ] Nenhum leitor (tela, importação, exportação, orçamento, integrações) usa mais o texto da tabela; a coluna de texto é removida ou mantida só como compatibilidade, sem divergir do cadastro.
- [ ] Testes e `tsc` verdes; conferência manual das constraints na migração.
