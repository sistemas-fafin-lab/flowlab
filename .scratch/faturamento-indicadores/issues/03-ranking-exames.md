# 03: Ranking de exames

**What to build:** o usuário vê o Top 10 de exames mais faturados do período, seguindo o botão R$ / Qtd. Cada exame aparece uma vez, identificado pelo código do procedimento e pela descrição mais usada daquele código no período. Uma nota curta avisa: "Particular entra no mês em que o lote mensal é criado".

**Blocked by:** 02 (Ranking de convênios + botão R$/Qtd).

**Status:** done

- [x] Código e descrição vêm pelo caminho `fatrequisicaoprocedimento → fatconvenioprocedimento → fattabelaprocedimento`, o mesmo das Faturas.
- [x] O agrupamento é só pelo código. O mesmo código com descrições diferentes (convênios diferentes) vira uma barra só.
- [x] A descrição mostrada é a mais frequente do código no período, ponderada pela quantidade, com desempate estável.
- [x] Em R$, a ordem é pela soma do `ValorLiquido`. Em Qtd, é pela soma da `Quantidade`. O tooltip mostra a outra métrica e o nome inteiro.
- [x] Corte no Top 10.
- [x] A nota do Particular aparece junto do ranking.
- [x] Testes do módulo:
  - mesmo código com descrições diferentes → uma barra, com a descrição mais frequente;
  - ordem por valor diferente da ordem por quantidade;
  - corte no Top 10.
