Status: ready-for-agent
Type: task

# Pendências: requisições não faturadas (janela M-2)

## Onde

Nova aba "Pendências" em `src/modules/faturamento/components/ContasReceberPage.tsx` (hoje 2 abas: Dashboard/Títulos) + nova rota de dados na API (`api/faturamento/[action].ts` + handler em `api/_lib/handlers/` + `api/_lib/faturamento/bdLab.ts`).

## Regra (decidida no grilling)

- Lote apLIS sem NF/RPS (`fatlote.IdRPS` nulo) em status ativos 1, 2, 3, 6, 7 (exclui 4 Recebido, 5 Cancelado, 8 Prejuízo), criado até o fim de M-2 (ex.: em agosto, lotes até 30/06 sem NF são pendência; jul/ago ficam de fora por estarem no fluxo normal).
- Verificação fina por requisição: o export do cliente tem `NFeNumero`, `RPSLote`, `RPSReq`, `NFeReq`, `DtaInclusaoLote` (colunas confirmadas no schema de `import_files/schema-backup-banco.csv` e no projeto csv-filter) — usar `NFeReq`/`RPSReq` para refinar a lista.
- Contagem de apoio verificada: lotes sem `IdRPS` por status (excluindo 5 e 8) = 1: 156, 2: 41, 3: 813, 4: 3188, 6: 4, 7: 873. Os "Recebidos sem RPS" (3188) ficam fora da regra — investigar na implementação se são NF lançadas fora do apLIS e registrar o achado em `docs/plans/faturamento/`.

## O que fazer

1. Nova consulta no `bdLab.ts` listando os lotes pendentes com requisições expandíveis (padrão `SQL_LISTA`/`SQL_DETALHE`), incluindo por requisição a situação de NF (`NFeReq`/`RPSReq` quando disponíveis).
2. Nova ação na API (ex.: `pendencias-nao-faturadas`) com cache de 3 min, seguindo o padrão dos handlers existentes.
3. Aba "Pendências" com a lista, filtros de período/operadora e expansão até a requisição.

## Critérios de aceite

- Em agosto, requisições de jan–jun sem NF aparecem como pendência; jul/ago não.
- Lotes cancelados/prejuízo não aparecem.
- A lista permite navegar até a requisição e ver sua situação de NF.
