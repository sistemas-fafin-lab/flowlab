Status: ready-for-agent
Type: task

# Faturas: sinalizar lotes com protocolo de envio duplicado (exceto AMHP-DF)

## Onde

`src/modules/faturamento/components/FaturasDashboard.tsx` (tabela de lotes, rodapé com protocolo `:533-536`), `hooks/useFaturamentoLotes.ts`, `api/_lib/handlers/faturamento-lotes.ts`, `api/_lib/faturamento/bdLab.ts`.

## Regra (decidida no grilling)

- Agrupar lotes por `Protocolo` não vazio; marcar todos os lotes de grupos com mais de um lote.
- Exceção: fonte pagadora AMHP-DF (`IdFontePagadora = 1025`) — seus lotes nunca são marcados (a AMHP usa protocolo-data compartilhado, ex.: `07082026` nos lotes 6490/6491; grupo de até 12 lotes).
- Achados dos dados: há duplicidade cruzada entre fontes (ex.: protocolo `760054` compartilhado por ASSEFAZ e Medigest) — o badge se aplica independentemente da fonte. A Medigest também usa protocolo-data legítimo (ex.: `03082026`), mas a exceção decidida cobre apenas a AMHP-DF; registrar o padrão da Medigest em `docs/plans/faturamento/` se atrapalhar o uso.

## O que fazer

1. Nova agregação no `bdLab.ts` (ex.: contagem de protocolos duplicados no período) ou subquery na `SQL_LISTA` indicando se o protocolo aparece em mais de um lote.
2. Badge visual no lote duplicado (coluna protocolo ou ao lado), com tooltip "protocolo duplicado em N lotes".
3. Filtro "protocolos duplicados" na barra de filtros do FaturasDashboard.
4. Sem bloqueio de operação.

## Critérios de aceite

- Lotes AMHP-DF nunca recebem o badge, mesmo com protocolo repetido.
- Lotes de outras operadoras com mesmo protocolo (ex.: Medigest, CASSI, ASSEFAZ, FUSEX) recebem badge e aparecem no filtro.
