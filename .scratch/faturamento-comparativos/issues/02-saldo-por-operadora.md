# 02: Saldo por operadora com filtros e comparação com o apLIS

**What to build:** o gráfico "Saldo por operadora" obedece aos filtros do Dashboard, ganha o alternador "Carteira total / Só emitidas no período" (padrão: carteira total), tooltip com a fórmula (Total − Recebido − Glosa acatada), a data da última baixa importada, e o **saldo no apLIS ao lado do saldo no sistema** por operadora, com a diferença sinalizada. Não altera o cálculo do saldo nem dá baixa. Ver `../spec.md`.

**Blocked by:** None (can start immediately).

**Status:** done (implementada em 3e04f5d, 06/11/2026, com ajustes em b06730c, fe9caf1, e126661 e e18e3ba; testes conferidos em 12/11/2026; conferida ao vivo em 12/11/2026: a referência de 06/11 não se reproduz, ver Comments)

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

### Conferência ao vivo (12/11/2026)

Rodada a mesma cadeia da rota (`titulosParaSaldo` → `filtrarUniverso` → `saldosAplisDosLotes` → `compararSaldos`), com a carteira total e sem filtros. Foram 1.657 títulos no universo, com apLIS até 11/11/2026.

| Operadora | Sistema | apLIS | Diferença | Ref. 06/11 |
|---|---:|---:|---:|---:|
| BRADESCO SAUDE - 005711 | 559.642,67 | 272.570,50 | **+287.072,17** | −45,9 mil |
| PMDF | 543.328,98 | 421.168,50 | **+122.160,48** | −12,9 mil |
| AMHP-DF | 313.374,69 | 207.348,40 | **+106.026,29** | −33,2 mil |

- **Sinal invertido:** a referência dizia que o sistema estava abaixo do apLIS; hoje ele está bem acima.
- **Total bate:** valor do título × valor líquido do lote difere R$ 202 no BRADESCO, R$ 5,5 mil no PMDF e R$ 40 mil no AMHP-DF. A glosa acatada é desprezível (R$ 977 no BRADESCO).
- **A diferença está no recebido.** Pelo apLIS, os lotes receberam R$ 287,8 mil a mais (BRADESCO), R$ 116,7 mil a mais (PMDF) e R$ 65,6 mil a mais (AMHP-DF) do que as baixas do sistema.
- **Causa:** as baixas pararam de ser importadas. No sistema, a última baixa é de 28/09 (BRADESCO), 25/09 (PMDF) e 09/09 (AMHP-DF). O apLIS registra recebimentos em outubro (BRADESCO R$ 162,5 mil, PMDF R$ 128,7 mil, AMHP-DF R$ 69,8 mil) e em novembro (BRADESCO R$ 58,4 mil até 10/11). Exemplos de lotes já pagos no apLIS e com título `aberta`: 6746 e 6747 (BRADESCO, ~R$ 33 mil cada), 6638 e 6624 (PMDF, ~R$ 25 mil cada).
- **Por que 06/11 não se reproduz:** os recebimentos de outubro já estavam no apLIS em 06/11, então pelo método da rota o sistema já estaria acima naquela data. Os números de 06/11 devem ter saído de outra base, provavelmente a carteira inteira do apLIS, incluindo lotes sem título no sistema. A rota compara só os lotes que têm título dos dois lados, de propósito.
- **A tela funciona como pedido:** ela mostra a divergência. O que precisa de ação é a importação das baixas de outubro e novembro. Corrigir o saldo continua fora do escopo desta issue.
