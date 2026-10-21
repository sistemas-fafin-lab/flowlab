# 05: Levantamento das tabelas associadas duplicadas

**What to build:** Um levantamento, lido do Supabase de produção, de todas as combinações (fonte, tabela) com o número de linhas de cada, entregue ao faturamento (Marcos Jr.). Ele devolve o mapa de junção (quais nomes são a mesma tabela) e, para cada TUSS/exame com preços diferentes nas tabelas a juntar, o preço que fica. Precisa de acesso de leitura em produção e de decisão humana. Ver spec: `../spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

- [ ] Lista de (fonte, tabela texto, nº de linhas) de produção, com grupos candidatos destacados (nomes iguais ignorando maiúsculas/espaços, ex.: Part/Particular/PARTICULAR/PART).
- [ ] Para os grupos candidatos, lista dos TUSS/exames com preços diferentes entre as tabelas.
- [ ] Mapa de junção devolvido pelo faturamento e registrado neste arquivo (em `## Comments`).
- [ ] Escolha de preço para cada conflito registrada neste arquivo.
- [ ] Confirmação explícita sobre "Part"/"PART" (o orçamento hoje os trata como outro uso).
