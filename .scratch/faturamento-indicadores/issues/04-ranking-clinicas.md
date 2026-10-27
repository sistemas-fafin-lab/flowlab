# 04: Ranking de clínicas

**What to build:** o usuário vê o Top 10 de clínicas (Local de Origem da requisição) com mais requisições faturadas no período, seguindo o botão R$ / Qtd. O título deixa claro que são "requisições faturadas" (pelo mês do lote), e não as requisições que entraram no mês.

**Blocked by:** 02 (Ranking de convênios + botão R$/Qtd).

**Status:** done

- [x] Clínica = Local de Origem da requisição (`requisicao.IdLocalOrigem` → `fatinstituicao`), o mesmo conceito de "Clínica" de Pendências → Particulares.
- [x] Em Qtd, a ordem é pelo número de requisições distintas (não de procedimentos). Em R$, é pela soma do `ValorLiquido` dessas requisições.
- [x] As requisições sem Local de Origem aparecem agrupadas como "Sem clínica".
- [x] O título diz "requisições faturadas".
- [x] O tooltip mostra o nome inteiro e a métrica que não está selecionada. Corte no Top 10.
- [x] Testes do módulo:
  - quantidade = requisições distintas, mesmo com vários procedimentos;
  - "Sem clínica";
  - ordem por valor diferente da ordem por quantidade.
