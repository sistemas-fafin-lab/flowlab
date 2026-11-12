# 02: Saldo por operadora com filtros e comparação com o apLIS

**What to build:** o gráfico "Saldo por operadora" obedece aos filtros do Dashboard, ganha o alternador "Carteira total / Só emitidas no período" (padrão: carteira total), tooltip com a fórmula (Total − Recebido − Glosa acatada), a data da última baixa importada, e o **saldo no apLIS ao lado do saldo no sistema** por operadora, com a diferença sinalizada. Não altera o cálculo do saldo nem dá baixa. Ver `../spec.md`.

**Blocked by:** None (can start immediately).

**Status:** done (implementada em 3e04f5d, 06/11/2026, com ajustes em b06730c, fe9caf1, e126661 e e18e3ba; testes conferidos em 12/11/2026; números não reconferidos ao vivo)

- [x] Filtros de período, operadora, lote e nota afetam o gráfico.
- [x] O alternador muda o saldo; "Carteira total" reproduz os números de hoje.
- [x] Mostra a última baixa importada.
- [x] Mostra saldo apLIS × sistema e a diferença; a conferência de 06/11/2026 (BRADESCO −R$ 45,9 mil, PMDF −R$ 12,9 mil, AMHP-DF −R$ 33,2 mil) serve de referência.
- [x] apLIS fora do ar: o gráfico do sistema continua e a comparação mostra aviso.
- [x] Testes da função de comparação (dados à mão) e da rota; `npm test` e typecheck passam.

## Comments

12/11/2026: a issue foi pedida para implementação, mas já estava entregue; só o status estava desatualizado.

- Filtros: a RPC `fat_dashboard_receber` e a rota `GET /api/faturamento/saldo-operadoras-aplis` recebem período, `operadoraId`, `lote` e `nota` (`filtrarUniverso`).
- Alternador: `p_somente_periodo` / `somentePeriodo`, padrão carteira total (migration `20261106160000_saldo_operadora_periodo.sql`).
- Última baixa: `ultimaBaixa` da RPC, mostrada no widget.
- Sistema × apLIS: `compararSaldos` em `api/_lib/faturamento/saldoOperadoras.ts`, com a tabela e a diferença no `SaldoOperadorasWidget`.
- apLIS fora do ar: a rota devolve 502 com `success:false`; o hook à parte (`useSaldoOperadorasAplis`) mostra o aviso e "Tentar novamente", e o gráfico do sistema continua.
- Testes: `saldoOperadoras.test.ts` e `faturamento-saldo-operadoras-aplis.test.ts` (24 testes) passam; `npm test` passa (201 arquivos, 2493 testes). O typecheck não aponta erro nos arquivos do saldo; os 25 erros que restam são de `src/components/IT/MindMapNodes.tsx` e `src/pages/IT/ITProjectMindMap.tsx`, sem relação com esta issue.
- Pendente: reconferir ao vivo os valores de BRADESCO, PMDF e AMHP-DF contra a referência de 06/11.
