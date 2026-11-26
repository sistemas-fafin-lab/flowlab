# 05: Cards de valor no Dashboard de glosa

Spec: `.scratch/glosas-recursos-calendario-pendencias/spec.md`

**What to build:** Valor glosado (% do faturado), Valor acatado (% do glosado), Glosa recuperada (% do glosado) e Saldo pendente (glosa em disputa) substituem os cards Abertas / Em recurso / Revertidas / Definitivas. Usam a classificação de funil dos cards de glosa do Contas a Receber, pelo mês do lote original, com quantidade e variação contra o mês anterior.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Função pura dos 4 cards a partir da classificação de funil, com testes (soma bate com o funil, percentuais com faturado zero e glosado zero, variação).
- [ ] O Dashboard de glosa recebe os cards e o faturado do período; a decisão sobre a origem do faturado (ver "Para revisar" no spec) fica registrada nas notas desta issue.
- [ ] Visual dos cards de glosa do Contas a Receber, nos temas claro e escuro; distribuição por status e rankings continuam iguais.
