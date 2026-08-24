Status: done
Type: task
Blocked by: 07, 08

# Dashboard: widgets-resumo das novas pendências

## Onde

`src/modules/faturamento/components/ContasReceberDashboard.tsx` (registry `DEFAULT_LAYOUTS`, persistência localStorage).

## O que fazer

1. Widget-resumo "Requisições não faturadas (até M-1)": contagem e valor total das pendências da issue 07. Ajustado de M-2 pra M-1 na issue 18 (grilling 24/08).
2. Widget-resumo "Particulares sem NF": contagem e valor total da issue 08.
3. Navegação dos widgets para a aba "Pendências" (com filtros aplicados, se simples).
4. Bump da chave de layout se necessário.

## Critérios de aceite

- Ambos os indicadores visíveis no dashboard com valores consistentes com a aba Pendências.

## Fora de escopo

- Widget para recebimento parcial pendente (issue 09) e para o vínculo NF+lote+Aplis (issue 12) — decisão de grilling (rodada 2, 2026-08-18): (c) fica só no drill-down do lote em Faturas, mais natural no contexto do lote; (d) é navegação/detalhe, não métrica agregável para widget.
