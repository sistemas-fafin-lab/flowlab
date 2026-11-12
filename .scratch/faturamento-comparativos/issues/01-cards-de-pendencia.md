# 01: Cards de pendência no Dashboard

**What to build:** o card "Pendências de faturamento" do Dashboard do Contas a Receber passa a ter 3 cards: **Requisições não faturadas** (sem lote, até M-1), **Particulares sem NF** (até D-1) e **Lotes sem nota fiscal** (a regra de hoje: sem NF/RPS, status de pendência, até M-1). Mesmo seletor de mês para os três. Clicar leva à sub-aba correspondente de Pendências. As regras das listas não mudam. Ver `../spec.md`.

**Blocked by:** None (can start immediately).

**Status:** done (valores conferidos ao vivo em 12/11/2026; tela não conferida no navegador)

- [x] O valor de "Requisições não faturadas" bate com o total da sub-aba "Sem lote" no mesmo mês. (12/11/2026: card e lista usam a mesma rota e o mesmo período; ao vivo, 10/2026 = 288 req / R$ 97.198,75 e 11/2026 = 789 req / R$ 253.321,38 nos dois. 06/2026 = 0.)
- [x] O valor de "Lotes sem nota fiscal" bate com o card antigo (R$ 93.939,56 / 41 lotes em 06/2026). (12/11/2026: mesma chamada do card antigo, `usePendenciasNaoFaturadas({ mesSolicitacao })`. Ao vivo deu 37 lotes / R$ 92.746,41: o dado do apLIS mudou desde 06/11. Nenhum lote de junho ganhou RPS nesse intervalo; a saída provável é mudança de status, que o `fatlote` não data.)
- [x] Cada card mostra valor e quantidade; o clique abre a sub-aba certa.
- [x] Falha do apLIS mostra aviso e "Tentar novamente".
- [x] Testes de rota (padrão de `faturamento-pendencias-particulares.test.ts`); `npm test` e typecheck passam.

## Observação

A lista "Sem lote" corta em **hoje**, não em M-1 como diz o spec. O card segue a lista (as regras das listas não mudam nesta issue). Se a regra deve ser M-1, isso pede uma issue própria.
