Status: done
Type: task

# Pendências: janela de "Sem NF (Lotes)" passa de M-2 para M-1

## Onde

`api/_lib/faturamento/bdLab.ts:890-925` (`listarLotesPendentes`) — cutoff calculado em `:904` (`LAST_DAY(CURDATE() - INTERVAL 2 MONTH)`), comentário da regra em `:806-824`. Mesma função alimenta a aba "Pendências" (issue 07) e o widget-resumo do Dashboard (issue 11) — é uma única lista, não duas.

## Problema

O relatório novo do setor distingue "Sem NF (Lotes)" (deveria valer até M-1) de "requisições não faturadas" em geral (M-2). Na implementação atual (issue 07) não existem duas listas — é uma regra só, a nível de lote, com corte em M-2. Decisão do grilling (24/08): não separar em duas listas — só ajustar a janela dessa lista única de M-2 para M-1.

## O que fazer

1. Trocar `INTERVAL 2 MONTH` por `INTERVAL 1 MONTH` em `bdLab.ts:904`.
2. Atualizar os comentários que documentam a regra (`:806-824`, `:844-852`) e o docstring de `api/_lib/handlers/faturamento-pendencias.ts` pra dizer M-1 em vez de M-2.
3. Atualizar o texto do widget-resumo no Dashboard (issue 11, `ContasReceberDashboard.tsx`) se ele citar "M-2" explicitamente na label.
4. Atualizar `issues/07-pendencias-requisicoes-nao-faturadas.md` e `issues/11-dashboard-widgets-pendencias.md` pra refletir a janela nova (M-1), já que a regra ali documentada muda.

## Critérios de aceite

- Em agosto, lotes sem NF criados até 30/06 (M-2) deixam de aparecer como pendência; só os até 31/07 (M-1) continuam.
- Widget-resumo do Dashboard reflete a mesma janela nova.

## Referência

Novo relatório de feedback do setor de faturamento (24/08), item 4.2.
