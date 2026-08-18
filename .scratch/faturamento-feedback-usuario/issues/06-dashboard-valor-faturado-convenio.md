Status: needs-info
Type: task

# Dashboard: valor faturado por convênio

## Adiada (2026-08-18)

Verificado em produção (Supabase `jqxeqmeikqclmmongclj`, via SQL Editor): `notas` tem só 5 linhas, todas de uma carga de seed única (mesmo timestamp `2026-03-27 14:45:38`), não uso orgânico do setor. `SUM(notas.valor_total)` por operadora hoje mostraria só esses 5 valores de teste, não o faturamento real. Mesma decisão da issue 05: manter a fonte nativa e adiar, em vez de migrar para o apLIS.

**Retomar quando**: `notas` tiver volume real de títulos criados pelo setor.

## Onde

`src/modules/faturamento/components/ContasReceberDashboard.tsx` (registry de widgets `DEFAULT_LAYOUTS`, persistência localStorage `flowLab_contas_receber_layout_*`) + RPC `fat_dashboard_receber`.

## O que fazer

1. Novo widget "Valor faturado por convênio": `SUM(notas.valor_total)` agrupado por operadora no período selecionado, seguindo o padrão do widget `saldo-operadoras`.
2. Expor a agregação no RPC (estender `fat_dashboard_receber` com `faturadoPorOperadora`, respeitando os filtros de período).
3. Registrar o widget no layout (bump da versão da chave se necessário).

## Critérios de aceite

- Dashboard mostra o valor total faturado por convênio no período, com valores completos acessíveis (tooltip/ordenação).
