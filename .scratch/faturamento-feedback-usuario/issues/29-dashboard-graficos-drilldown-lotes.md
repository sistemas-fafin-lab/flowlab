Status: needs-triage
Type: feature

# Dashboard: ver quais lotes estão agrupados nos gráficos + dados adicionais ausentes

## Onde

`src/modules/faturamento/components/ContasReceberDashboard.tsx` — gráficos de
aging (`:592`), saldo por operadora (`:619`) e série temporal (`:722`/`:748`),
todos `recharts` `BarChart` sobre `notas`/`titulos` (Supabase).

## Problema

Relato do quarto relatório do setor (27/08): "há alguma forma de visualizar
quais lotes estão agrupados dentro [dos gráficos]? Alguns dados adicionais
também não estão aparecendo."

## Mesma família de dado das issues 01/05/06/12/23

Esses gráficos leem de `notas`/`titulos` — a mesma fonte sem uso orgânico
ainda em produção (issues 01/05/06/12, reafirmado na issue 23). Duas coisas
distintas no relato:

1. **Drill-down (quais lotes compõem cada barra)**: pedido de feature nova —
   hoje os gráficos mostram só o agregado, sem abrir o detalhe por lote. Não
   dá pra testar/desenhar essa interação direito enquanto a fonte de dado
   não tem volume real (mesmo problema estrutural das issues adiadas).
2. **"Dados adicionais não aparecem"**: relato vago demais para agir — não
   ficou claro quais dados especificamente. Precisa de exemplo concreto
   (print ou descrição de qual widget/coluna).

## O que fazer

- Perguntar ao setor: quais dados adicionais especificamente estão faltando
  (nome do widget/gráfico + o dado esperado)?
- Registrar o pedido de drill-down por lote como feature represada junto do
  mesmo critério de retomada das issues 01/05/06/12: revisitar quando
  `notas`/`titulos` tiverem volume orgânico real, momento em que também dá
  pra validar se o drill-down por lote faz sentido do jeito pedido.

## Critérios de aceite

- Exemplo concreto do "dado adicional ausente" antes de investigar código.
- Decisão registrada sobre se o drill-down por lote entra nesta rodada ou
  fica represado com as demais issues de fonte de dado vazia.

## Referência

Quarto relatório de feedback do setor de faturamento (27/08).
