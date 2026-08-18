Status: ready-for-agent
Type: task
Blocked by: 07, 08

# Dashboard: widgets-resumo das novas pendências

## Onde

`src/modules/faturamento/components/ContasReceberDashboard.tsx` (registry `DEFAULT_LAYOUTS`, persistência localStorage).

## O que fazer

1. Widget-resumo "Requisições não faturadas (até M-2)": contagem e valor total das pendências da issue 07.
2. Widget-resumo "Particulares sem NF": contagem e valor total da issue 08.
3. Navegação dos widgets para a aba "Pendências" (com filtros aplicados, se simples).
4. Bump da chave de layout se necessário.

## Critérios de aceite

- Ambos os indicadores visíveis no dashboard com valores consistentes com a aba Pendências.
