Status: done
Type: task

# Pendências "Sem lote": requisições com exame cancelado apareciam na lista

## Onde

`api/_lib/faturamento/bdLab.ts` — `SQL_SEM_LOTE_WHERE` (usada por
`listarRequisicoesSemLote`, issue 21) e `ID_EVENTO_EXAME_CANCELADO`.

## Problema

Relato do quarto relatório do setor (27/08): "na listagem de 'requisições sem
lote' existem requisições canceladas que não deveriam ser incluídas."

## Investigado em 27/08 — confirmado com dado real

`SQL_SEM_LOTE_WHERE` (issue 21) já excluía Particular/Cortesia e requisição já
cobrada fora do fluxo de lote, mas não olhava o evento atual da requisição.
Consultei direto no MySQL do apLIS a mesma condição da query (`Lote IS NULL`,
fonte pagadora de convênio, com procedimento cobrável, sem RPS ativo já
lançado):

- **3.430 requisições** batiam com a condição da lista hoje.
- **575 delas (16,8%)** têm `requisicao.CodEvento = 8` — o evento
  `evento.DesEvento = 'Exame Cancelado'` (`StatusExame = 2`, `Excecao = 1`).
  Valor: **R$ 224.662,69** de um total de R$ 1.028.562,08 na lista (21,8%).
- Exame cancelado nunca vai gerar lote/cobrança — essas linhas são ruído
  permanente na lista, não pendência real.
- Descartei filtrar por `StatusExame = 2` em vez do `CodEvento` específico:
  esse `StatusExame` é uma faixa larga que também cobre eventos faturáveis
  (`1022` FAT. EXTERNO, `1042` Exame adicional, `1039` APENAS PARA FATURAMENTO
  DA SULAMERICA) — filtrar por ele excluiria pendência real.

## O que foi feito

Adicionado `AND (r.CodEvento IS NULL OR r.CodEvento <> 8)` a
`SQL_SEM_LOTE_WHERE`, com a constante `ID_EVENTO_EXAME_CANCELADO = 8`
documentada no código. Não mexe em `listarLotesPendentes`/
`listarParticularesPendentes` (issues 07/08/18/19) — o relato foi
especificamente sobre a lista nova da issue 21, e cada lista tem sua própria
regra de corte por decisão anterior (ver issue 19, "sem corte por CodEvento").

## Critérios de aceite

- Requisição com evento atual "Exame Cancelado" (`CodEvento = 8`) não aparece
  mais em `listarRequisicoesSemLote` / aba "Sem lote" de Pendências.
- Pendência real de convênio sem lote continua aparecendo normalmente.

## Referência

Quarto relatório de feedback do setor de faturamento (27/08). Verificado com
dado real de produção (apLIS, túnel MySQL do `.env`) em 2026-08-27.
