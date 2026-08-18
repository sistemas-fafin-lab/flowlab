Status: ready-for-agent
Type: research

# Investigar divergência faturado × recebido no dashboard (e guias R$0 como "recebidas")

## Onde

KPIs do dashboard: RPC `fat_dashboard_receber` — versão atual em `supabase/migrations/20260810140000_revisao_contas_receber_baixa_severidade.sql:436-450`; cálculo de `valor_recebido`/status da nota em `supabase/migrations/20260807120000_contas_receber.sql:177-238` (`fat_recalcular_nota`). Exibição: `src/modules/faturamento/components/ContasReceberDashboard.tsx:411-443` e `:620-644`.

## Problema

Feedback do setor: "divergência no flowlab entre os valores apresentados como faturados e recebidos" e "requisições com valor de R$ 0,00 que aparecem no Flow como recebidas". Exemplos: requisição 0100024943007 (lote 6108) e 0040001906000 (lote 6075).

Fatos já levantados (apLIS, somente leitura, verificados também contra `import_files/schema-backup-banco.csv`):

- 0100024943007 = `requisicao.IdRequisicao 188604` (lote 6108, Bradesco): `ValorLiquido` 94,51, `ValorRecebido` 0,00, `DtaRecebido` 19/06/2026, `DesMotivoGlosa` 1702 → glosa integral.
- 0040001906000 = `IdRequisicao 190485` (lote 6075, PMDF): dois procedimentos com `ValorRecebido` 10,08/19,96 × `ValorLiquido` 10,29/20,37.
- Motivos conferidos em `fatmotivoglosa`: 1702 = "COBRANÇA DE PROCEDIMENTO EM DUPLICIDADE" (`IdMotivoGlosa` 134); 2902 = "GLOSA MANTIDA" (388).
- Ambas as requisições têm `CodEventoFatur` = 6 ("GLOSADO ainda SEM RECURSO", tabela `eventofatur`) — no apLIS elas são glosadas sem recurso, não recebidas.
- `faturado` = `SUM(notas.valor_total)` dos títulos emitidos no período; `recebido` = `SUM(notas.valor_recebido)` (soma de baixas) sobre os mesmos títulos — fontes e eventos diferentes.
- Status "recebida" é da nota (`v_recebido >= v_total`); guias do snapshot têm `status = 'faturada'` para sempre (`20260807130000_contas_receber_rpcs.sql:178`).
- Baixa acima do saldo é aceita (achado 4.4 de `docs/plans/faturamento/revisao-contas-receber.md:935-961`) e força "recebida" com saldo negativo.
- O `.env` local aponta para a mesma instância MySQL do csv-filter (`lab`), mas a instância Supabase local não tem os snapshots reais — investigar no ambiente que o cliente usa.

## O que investigar

1. No ambiente real, conferir como os lotes 6108/6075 aparecem (título, baixas, glosas, guias) e reproduzir as guias R$0 como "recebidas".
2. Identificar as causas da divergência faturado × recebido (ex.: baixas registradas em títulos emitidos fora do período; superpagamento; glosas fora da nota).
3. Propor correção de exibição/semântica do KPI.

## Direções possíveis (não prescritivo)

- Excluir guias de valor 0 da contagem de "recebidas" (alinhado com a issue 09, que passa a ler `ValorRecebido`/`CodEventoFatur` do apLIS).
- Revisar a janela do KPI "recebido" (por competência da baixa em vez de emissão do título) ou sinalizar superpagamentos no dashboard.

## Referência

Feedback do setor de faturamento, item 3.2; achados 4.4 e 4.9 de `docs/plans/faturamento/revisao-contas-receber.md`.
