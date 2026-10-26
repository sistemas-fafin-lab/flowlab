# 05: Levantamento das tabelas associadas duplicadas

**What to build:** Um levantamento, lido do Supabase de produção, de todas as combinações (fonte, tabela) com o número de linhas de cada, entregue ao faturamento (Marcos Jr.). Ele devolve o mapa de junção (quais nomes são a mesma tabela) e, para cada TUSS/exame com preços diferentes nas tabelas a juntar, o preço que fica. Precisa de acesso de leitura em produção e de decisão humana. Ver spec: `../spec.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Lista de (fonte, tabela texto, nº de linhas) de produção, com grupos candidatos destacados (nomes iguais ignorando maiúsculas/espaços, ex.: Part/Particular/PARTICULAR/PART).
- [x] Para os grupos candidatos, lista dos TUSS/exames com preços diferentes entre as tabelas.
- [x] Mapa de junção devolvido pelo faturamento e registrado neste arquivo (em `## Comments`).
- [x] Escolha de preço para cada conflito registrada neste arquivo.
- [x] Confirmação explícita sobre "Part"/"PART" (o orçamento hoje os trata como outro uso).

- 2026-10-26 — Levantamento de produção (jqx, só leitura): 87 tabelas em 38 fontes, 4.670 linhas.
  - Único grupo candidato (mesmo nome ignorando maiúsculas/espaços/acentos, mais a família Part/Particular): fonte Particular — "Particular" (389 linhas, a do orçamento), "PARTICULAR" (2), "part" (3), "PART" (1) e uma de nome vazio (1, id e4211841-a94b-45c8-b4c1-60e647d171cf).
  - Conflitos de preço (mesma chave do planejarUnificacao: exame ou TUSS sem espaços; valor, atendido, desconto particular): **nenhum**. Só uma chave existe em duas tabelas: TUSS 40601200 (biópsia sextante) em "PART" e "Particular", R$ 1.000,00 nas duas; a linha de "PART" tem 2 exclusões de exame, e a de "PARTICULAR" com o exame IMUFIX tem 14 valores por exame — ambos remapeados se juntar.
  - Suspeitas de teste: "part" (2 linhas de R$ 5.000, uma com o nome do exame no lugar do TUSS) e a tabela "Particular" da fonte PMDF (1 linha, TUSS "t3").
  - Pares "X" / "X - MEDICINA LABORATORIAL" (quase todas as fontes de convênio) tratados como contratos diferentes, não candidatos.
  - Página para o faturamento responder (respostas gravadas no banco da página, coleção `decisoes`, um doc por id de tabela; observações em `geral/observacoes`): https://claude.ai/artifact/5Yd2jBkEeLtsStuZDWYhs7

- 2026-10-26 — Decisão (dono do projeto, na conversa): juntar "PARTICULAR", "part", "PART" e a de nome vazio na "Particular", inclusive as linhas que pareciam teste. Isso inclui "PART": a Tabela Particular do orçamento passa a ter as linhas dela. Sem escolhas de preço (nenhum conflito). A tabela "Particular" da fonte PMDF não entra (outra fonte) e fica como está. Mapa em `../mapa-unificacao.json`.
