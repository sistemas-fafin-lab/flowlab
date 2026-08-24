Status: needs-info
Type: research

# Investigar: filtro "Todas" (operadora) mostra NFs fora do período selecionado, inclusive R$0,00 como "Recebido"

## Onde

`src/modules/faturamento/components/TitulosList.tsx:224-236` (filtro "Operadora", opção `{ value: '', label: 'Todas' }`) + `hooks/useContasReceber.ts:134-202` (monta a query: `.gte('data_emissao', desde).lte('data_emissao', ate)` sempre aplicado; `.eq('operadora_id', operadoraId)` só se `operadoraId` truthy; `.eq('status', status)` só se `status` truthy; busca livre via `.or(condicoes.join(','))` quando `busca` preenchido).

## Problema

Feedback do setor (item 4.1, aba Títulos/Aberta): com o filtro de operadora em "Todas", aparecem NFs antigas fora do período (`desde`/`ate`) e do convênio selecionados, inclusive registros marcados como "Recebido" mas com valor R$ 0,00 no campo correspondente.

"Todas" aqui é o valor vazio do filtro de **Operadora** (não é status — não existe opção "Todas" no filtro de Status). Pela leitura do código, `desde`/`ate` são aplicados incondicionalmente na query (`.gte`/`.lte`), então não é óbvio por que registros fora desse intervalo apareceriam. Hipóteses a checar:

1. Interação entre o filtro de busca livre (`busca`, campo texto) e os filtros de data/operadora — checar se o `.or(condicoes...)` do Supabase/PostgREST está de fato sendo ANDed com os `.gte`/`.lte` anteriores, ou se alguma condição da busca livre inclui um campo que reabre o filtro de data.
2. Estado do filtro de data não sendo aplicado de fato quando operadora = "Todas" — checar se `onFiltrar` ou algum efeito reseta `desde`/`ate` nesse caminho.
3. Registros "Recebido" com `valor_recebido = 0,00` — checar a trigger/RPC de recálculo de status (`fat_recalcular_nota`, `supabase/migrations/20260807120000_contas_receber.sql:177-238`) pra ver se existe caminho em que o status vira "recebida" sem valor lançado (ex.: baixa de R$0 registrada por engano, ou status não recalculado após alguma operação).

## O que investigar

1. Reproduzir com dado real: aplicar filtro de operadora "Todas" + um período restrito e conferir se de fato aparecem títulos com `data_emissao` fora do intervalo.
2. Se reproduzir, isolar se a causa é a busca livre, o estado do filtro de data, ou algo na query/RPC.
3. Conferir os títulos "Recebido" com valor R$0,00 mencionados — achar exemplos concretos (como fizeram as issues 01/04) e checar `valor_recebido`/`status` desses registros.

## Critérios de aceite (após virar fix)

- Com filtro de operadora "Todas" e um período selecionado, só aparecem títulos com `data_emissao` dentro do período.
- Não aparecem títulos "Recebido" com `valor_recebido = 0,00` sem explicação (ou a causa raiz é outra e a issue é revisada).

## Referência

Novo relatório de feedback do setor de faturamento (24/08), item 4.1.
