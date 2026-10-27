# 02: Ranking de convênios + botão R$/Qtd

**What to build:** abaixo dos cards, o usuário vê o Top 10 de convênios (fontes pagadoras) que mais faturaram no período, em barras horizontais no visual do Dashboard de Glosas. Um botão R$ / Qtd no cabeçalho troca a ordenação do ranking na hora, sem recarregar os dados. Esse botão é o mesmo que os rankings de exames e de clínicas vão usar.

O módulo de indicadores passa a devolver o ranking já calculado nas duas ordenações. O botão só escolhe qual delas mostrar.

**Blocked by:** 01 (Página Indicadores com o modo Mês e os cards).

**Status:** done

- [x] Convênio = fonte pagadora do lote (`fatlote.IdFontePagadora`), pelo nome fantasia.
- [x] Em R$, a ordem é pela soma do `ValorLiquido`. Em Qtd, é pela soma da `Quantidade` (exames faturados).
- [x] Cada item traz as duas métricas. O tooltip mostra o nome inteiro e a métrica que não está selecionada.
- [x] Corte no Top 10.
- [x] O Particular aparece como mais uma fonte pagadora.
- [x] O botão R$ / Qtd fica no cabeçalho, começa em R$ e não refaz a consulta.
- [x] Os cards não mudam com o botão.
- [x] Eixo em milhares no modo R$. Rótulo encurtado no eixo, com o nome inteiro no tooltip.
- [x] Testes do módulo:
  - agrupamento pela fonte pagadora do lote;
  - ordem por valor diferente da ordem por quantidade;
  - corte no Top 10.

## Comments

- 26/10/2026: implementado. `resumirIndicadores` devolve `rankings.convenios` (`porValor` / `porQuantidade`, Top 10, empate pela outra métrica e depois pelo nome). Na tela, `RankingBarras` + botão R$/Qtd no cabeçalho, prontos para os rankings de exames e clínicas.
  - Conferido no banco, set/2026: em R$, BRADESCO SAUDE - 005711 (R$ 228.988,21) > PMDF > CASSI; em Qtd, PMDF (4.361 exames) > CASSI > BRADESCO.
  - Atenção: em out/2026 o Particular soma R$ 3,0 mi / 14.274 exames, por causa do lote 7012 (criado em 13/10, 6.381 requisições, R$ 2,88 mi), além dos dois lotes mensais de 05/10. Pela regra do lote, ele entra em outubro. Conferir se esse lote é um acerto que deveria ficar de fora.
