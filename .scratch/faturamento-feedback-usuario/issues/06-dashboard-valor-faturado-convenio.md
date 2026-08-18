Status: ready-for-agent
Type: task

# Dashboard: valor faturado por convênio

## Onde

`src/modules/faturamento/components/ContasReceberDashboard.tsx` (registry de widgets `DEFAULT_LAYOUTS`, persistência localStorage `flowLab_contas_receber_layout_*`) + RPC `fat_dashboard_receber`.

## O que fazer

1. Novo widget "Valor faturado por convênio": `SUM(notas.valor_total)` agrupado por operadora no período selecionado, seguindo o padrão do widget `saldo-operadoras`.
2. Expor a agregação no RPC (estender `fat_dashboard_receber` com `faturadoPorOperadora`, respeitando os filtros de período).
3. Registrar o widget no layout (bump da versão da chave se necessário).

## Critérios de aceite

- Dashboard mostra o valor total faturado por convênio no período, com valores completos acessíveis (tooltip/ordenação).
