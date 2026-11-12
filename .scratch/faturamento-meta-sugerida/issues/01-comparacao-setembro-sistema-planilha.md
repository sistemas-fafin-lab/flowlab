# 01: Comparação de setembro — sistema × planilha

**What to build:** um relatório para o faturamento com os Elegíveis de setembro/2026 por convênio, calculados pelas regras da spec (`../spec.md`). Ele fica ao lado dos números da planilha do setor e destaca as diferenças, para o faturamento explicá-las antes da publicação.

A simulação considera AMIL, ASSEFAZ, SELECT e STM como marcados em "considerada na meta". Ela usa só leitura no MySQL do apLIS e não altera nada em produção.

**Blocked by:** None (can start immediately).

**Status:** done (12/11/2026; aguardando o faturamento explicar as diferenças, issue 05)

- [x] Elegíveis de setembro/2026 por convênio: soma de `ValorLiquido` por `DtaSolicitacao`, com e sem lote, sem `EVENTOS_NAO_COBRAVEIS`, só com a whitelist atual + AMIL, ASSEFAZ, SELECT e STM.
- [x] Totais de setembro no sistema ao lado da planilha: Admissões R$ 1.212.335,21, Elegíveis R$ 1.186.656,81 e Não elegíveis R$ 24.478,40.
- [x] Lista das fontes não elegíveis com valor no mês, incluindo ABAC.
- [x] Sem dado pessoal de paciente no relatório.
- [x] O relatório fica num lugar que o usuário possa repassar ao faturamento, e o caminho é informado na conclusão.
- [ ] Os mesmos totais de maio a agosto/2026, sistema × planilha, como pergunta em aberto sobre a falta de R$ 180–204 mil (não bloqueia a 05).

## Entrega (12/11/2026)

Relatório em `relatorio-setembro-2026.md`, nesta pasta.

- Setembro/2026, sistema × planilha: Admissões R$ 1.210.606,73 (−R$ 1.728,48), Elegíveis R$ 1.185.538,20 (−R$ 1.118,61) e Não elegíveis R$ 25.068,53 (+R$ 590,13).
- **Achado:** a PARTICULAR (1102) está marcada como "considerada na meta" e soma R$ 63.459,05 nos Elegíveis de setembro. A pergunta foi para o faturamento.
- SELECT (1365) não teve requisição em setembro.
- **Faltando:** os números da planilha por convênio (e os totais de maio a agosto) não estão no repositório. O relatório traz por convênio só o lado do sistema; com a planilha, dá para pôr a coluna dela ao lado e achar qual convênio explica a diferença de setembro.
- De maio a agosto, o relatório traz só o lado do sistema, porque os números mês a mês da planilha não estão no repositório. No sistema, Elegíveis + Não elegíveis fecha com as Admissões.
