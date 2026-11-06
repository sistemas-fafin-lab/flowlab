# 02: Saldo por operadora com filtros e comparação com o apLIS

**What to build:** o gráfico "Saldo por operadora" obedece aos filtros do Dashboard, ganha o alternador "Carteira total / Só emitidas no período" (padrão: carteira total), tooltip com a fórmula (Total − Recebido − Glosa acatada), a data da última baixa importada, e o **saldo no apLIS ao lado do saldo no sistema** por operadora, com a diferença sinalizada. Não altera o cálculo do saldo nem dá baixa. Ver `../spec.md`.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Filtros de período, operadora, lote e nota afetam o gráfico.
- [ ] O alternador muda o saldo; "Carteira total" reproduz os números de hoje.
- [ ] Mostra a última baixa importada.
- [ ] Mostra saldo apLIS × sistema e a diferença; a conferência de 06/11/2026 (BRADESCO −R$ 45,9 mil, PMDF −R$ 12,9 mil, AMHP-DF −R$ 33,2 mil) serve de referência.
- [ ] apLIS fora do ar: o gráfico do sistema continua e a comparação mostra aviso.
- [ ] Testes da função de comparação (dados à mão) e da rota; `npm test` e typecheck passam.
