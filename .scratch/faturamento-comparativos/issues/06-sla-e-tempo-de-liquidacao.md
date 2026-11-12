# 06: SLA por convênio e tempo médio de liquidação

**What to build:** na aba Comparativos, o tempo médio (dias) por convênio de: cadastro → envio ao faturamento (primeira tarefa tipo 34); envio → recebido no faturamento (primeira tarefa 37 ou 44); recebido → faturado (fechamento do lote, fallback criação). Cadastro = evento "Admissão" do histórico, fallback data de solicitação. Mais o **tempo médio de liquidação** (faturado → recebido), só de requisições já recebidas, com "% já recebido". Cada marco indica a fonte (apLIS hoje). Intervalos negativos são descartados e contados à parte. Ver `../spec.md`.

**Blocked by:** 03

**Status:** needs-info (entregue com a tarefa 34; falta a usuária confirmar que ela é o envio)

Pergunta aberta para a usuária: a tarefa 34 é mesmo o envio ao faturamento? Implementar com a 34 e trocar só esse marco se a resposta for outra.

- [x] Média por convênio e total, para os 3 meses.
- [x] Fallbacks, intervalo negativo e convênio sem dados cobertos por testes de função pura.
- [x] Liquidação mostra o "% já recebido".
- [x] `npm test` e typecheck passam.

## Entregue

Rota `GET /api/faturamento/comparativos-sla?mes=YYYY-MM`; cálculo puro em `src/modules/faturamento/utils/slaFaturamento.ts`; leitura em `listarMarcosSla` (`api/_lib/faturamento/bdLab.ts`); bloco `SlaConvenioComparativo.tsx` na aba Comparativos, antes do volume de envio.

- **Mês da requisição** = mês em que foi faturada (fechamento do lote; sem ele, criação), a competência do funil. Assim as etapas até o faturado já aconteceram e a liquidação mostra quanto do mês já entrou.
- **Universo**: requisições em lote com status diferente de cancelado (5) e prejuízo (8), fora fontes Particular. "Convênio" = fonte pagadora do lote, como no volume de envio.
- **Marcos**: Admissão = evento 1 de `requisicaohistorico`; envio = primeira tarefa 34; recebido no faturamento = primeira tarefa 37/44; recebido (liquidação) = `fatrequisicaostatus.DtaRecebido`. A liquidação é em dias de calendário (a data de recebimento não tem hora); as outras etapas usam data e hora.
- Média e mediana (dica no mouse) com 1 casa; intervalo negativo sai da média e aparece na nota do mês, assim como as requisições que usaram fallback. O total do mês junta todas as requisições (não é média das médias).
- Tela: total dos 3 meses lado a lado; tabela por convênio um mês por vez; legenda com a fonte de cada marco. Para trocar a tarefa 34, mudar `TIPO_TAREFA_ENVIO_FATURAMENTO` em `bdLab.ts` e o texto de `FONTES_MARCOS.envio`.

### Conferido no banco em 12/11/2026 (ref. out/2026)

ago–out: 12.102 requisições, leitura em ~2 s. Total de out: cadastro → envio 2,8 d; envio → recebido 1,9 d; recebido → faturado 9,6 d; liquidação 32,1 d com 12,4% já recebido (set: 40,9 d, 38,6%; ago: 44,3 d, 85,4%).

### Para conferir com a usuária

- **Tarefa 34** como envio ao faturamento (pergunta acima).
- **Agosto tem poucas tarefas 34/37/44** (≈300 de 4.316 requisições): as etapas do meio de ago refletem uma amostra pequena.
- **Liquidação com muitos descartes** (ago: 834): quase todas foram recebidas antes da criação do lote atual, ou seja, requisição que mudou de lote ou foi refaturada depois de paga. Ficam fora da média e contam como recebidas no %.
- **Recebida a zero** (glosa total, ~50 por trimestre) conta como recebida no %.
- **Recebido → faturado descartado** (out: 688): o apLIS sobrescreve `DtaFechamento` ao refechar o lote, então a tarefa 37/44 pode vir depois do fechamento que ficou gravado.
