Status: needs-triage
Type: task
Blocked by: 18

# Pendências: Particulares sem NF deixa de exigir laudo emitido e ganha janela M-1

## Onde

`api/_lib/faturamento/bdLab.ts:1070-1200` (`listarParticularesPendentes`) — filtro atual em `SQL_PARTICULARES_PENDENTES_WHERE` (`:1147-1149`), constante `EVENTOS_LAUDO_LIBERADO_PARTICULAR` (`:1090`). Hoje essa consulta não tem nenhum corte de tempo (diferente de `listarLotesPendentes`, que usa o cutoff de `:904`).

## Problema

A regra atual (issue 08) só lista particulares (`IdFontePagadora = 1102`) com laudo já liberado (`CodEvento` em `EVENTOS_LAUDO_LIBERADO_PARTICULAR`) e sem NF. O setor reporta que isso está errado: a NF do paciente particular precisa ser emitida no momento do **pagamento**, que acontece antes do laudo — exigir laudo liberado esconde particulares que já deveriam ter NF emitida.

Sem o filtro de laudo, a lista passa a contar da data de **registro** da requisição, não da data do laudo — sem um corte de tempo, tende a trazer particulares muito antigos e virar ruído. Decisão do grilling (24/08): aplicar a mesma janela M-1 da issue 18 (ver `Blocked by`).

## O que fazer

1. Remover a condição `r.CodEvento IN (...)` (`EVENTOS_LAUDO_LIBERADO_PARTICULAR`) do `WHERE` — manter só `IdFontePagadora = 1102` + sem NF (`IdRPS`/`NFeReq` conforme o padrão já usado).
2. Adicionar o mesmo corte de janela M-1 usado em `listarLotesPendentes` (reaproveitar a query de cutoff de `bdLab.ts:904`, já ajustada pela issue 18), aplicado sobre a data de criação/registro da requisição.
3. Atualizar `issues/08-pendencias-particulares-sem-nf.md` pra refletir a regra nova (sem exigência de laudo, com janela M-1).
4. Conferir se `EVENTOS_LAUDO_LIBERADO_PARTICULAR`/`ID_FONTE_PAGADORA_PARTICULAR` ficam sem uso em outro lugar do arquivo antes de remover a constante de eventos.

## Critérios de aceite

- Particulares (fonte 1102) sem NF aparecem na lista de Pendências independente do laudo ter sido liberado ou não.
- A lista respeita a janela M-1 (mesmo corte da issue 18) — particulares fora dela não aparecem.

## Referência

Novo relatório de feedback do setor de faturamento (24/08), item 4.2.
