# 06: Unificação das tabelas associadas duplicadas

**What to build:** As tabelas duplicadas da mesma fonte são unificadas exatamente como o faturamento decidiu no levantamento: as linhas passam para a tabela que fica, o preço escolhido prevalece em cada conflito, e exclusões e valores personalizados por exame acompanham a linha que fica. Depois disso, a fonte Particular não mostra mais Part/Particular/PARTICULAR/PART como tabelas separadas (salvo o que o mapa mantiver separado). Ver spec: `../spec.md`.

**Blocked by:** 01 — Cadastro de tabelas associadas; 04 — Tela, orçamento e exportação por id; 05 — Levantamento das tabelas duplicadas

**Status:** ready-for-agent

- [ ] Função pura de planejamento: recebe linhas atuais, mapa de junção e escolhas de preço; devolve os conflitos sem resposta **ou** as operações (apontar linhas para a tabela que fica, remover linhas perdedoras, remapear exclusões e valores personalizados, remover cadastros vazios).
- [ ] Testes: sem conflitos → operações; conflito sem escolha → bloqueio; escolha aplicada → linha perdedora removida e ajustes remapeados; nome fora do mapa intocado.
- [ ] Migração gerada a partir de um plano sem conflitos, aplicando o mapa e as escolhas registrados no ticket 05.
- [ ] Conferência pós-migração: nenhum par (tabela, TUSS) ou (tabela, exame) duplicado; Tabela Particular do orçamento com os preços escolhidos.
