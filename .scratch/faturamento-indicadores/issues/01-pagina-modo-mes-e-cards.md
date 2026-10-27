# 01: Página Indicadores com o modo Mês e os cards

**What to build:** o usuário do faturamento abre "Indicadores" no menu do Faturamento, escolhe um mês (a página já vem com o mês anterior) e vê três cards: total faturado (R$), nº de requisições faturadas e nº de exames faturados. Cada card mostra a variação sobre o mês anterior. A página avisa até quando o banco de backup tem dados.

Este ticket monta o caminho inteiro, de ponta a ponta:
- a consulta ao banco do laboratório: lotes criados no período, sem os cancelados, achatados em lote × requisição × procedimento, com o `ValorLiquido`;
- a ação nova no dispatcher do faturamento;
- o módulo de indicadores (funções puras) com as janelas e os cards;
- o hook, a rota protegida, o item de menu e a página.

Ver `.scratch/faturamento-indicadores/spec.md` (Implementation Decisions → Fonte dos dados e Módulo de indicadores).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Item "Indicadores" no menu do Faturamento, ao lado de Faturas, Recebimentos e Glosas, visível só com a permissão de visualização do Faturamento.
- [x] Rota protegida pela mesma permissão. Sem a permissão, a página não abre.
- [x] Seletor de mês que já vem com o mês anterior ao atual.
- [x] O período vale pela data de criação do lote (`fatlote.DtaCriacao`), e os lotes com status 5 (Cancelado) ficam de fora.
- [x] Card "Total faturado" = soma do `ValorLiquido` dos procedimentos das requisições dos lotes do período.
- [x] Card "Requisições faturadas" = número de requisições distintas.
- [x] Card "Exames faturados" = soma da `Quantidade`.
- [x] Cada card mostra a variação percentual sobre o mês anterior, e "—" quando o mês anterior é zero.
- [x] O aviso "dados até dd/mm hh:mm" usa a data do dado mais recente do backup.
- [x] Esqueleto enquanto carrega e mensagem de erro clara quando o banco do laboratório não responde.
- [x] Tema claro e escuro.
- [x] Testes do módulo:
  - mês anterior, incluindo a virada de ano (jan → dez);
  - requisição com vários procedimentos conta 1;
  - quantidade maior que 1 soma na contagem de exames;
  - variação positiva, negativa e nula;
  - as linhas da janela anterior não entram na atual.
- [x] Conferência manual: o total faturado de set/2026 bate com R$ 1.380.054,78 (valor levantado no banco em 26/10/2026, ver Further Notes da spec).

## Comments

- 26/10/2026: implementado. Conferência manual: set/2026 = R$ 1.380.054,78 (9.832 linhas, 4.354 requisições, 10.407 exames), variação sobre ago/2026 de +8,3% / +5,9% / +19,9%.
