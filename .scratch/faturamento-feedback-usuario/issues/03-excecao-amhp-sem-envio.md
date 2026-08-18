Status: ready-for-agent
Type: task

# Títulos – Aberta: exceção AMHP-DF no aviso "sem envio"

## Onde

`src/modules/faturamento/components/NovoTituloModal.tsx` — regra em `:159` (`lotesSemEnvio = lotes.filter((lote) => !lote.dtaEnvio)`), linha do lote `:291-301`, aviso da página `:347-352`. Exibição auxiliar em `TitulosList.tsx:411-413` (`envio —` quando nulo).

## Problema

O apLIS não grava `DtaEnvio` nos lotes da AMHP-DF. Verificado no banco: lotes 6490/6491 — `Status` 3 (Faturado), `DtaEnvio` NULL, `Protocolo` 07082026, `IdRPS` NULL, `IdFontePagadora` 1025 (AMHP-DF). O modal de criação de título os marca como "sem envio", o que é falso para essa operadora.

## O que fazer

1. Identificar a fonte pagadora do lote no payload do `bdLab.ts` (confirmar o campo disponível — `IdFontePagadora`/nome) e excluir lotes da AMHP-DF (`IdFontePagadora = 1025`) da contagem e do aviso "sem envio".
2. Manter o aviso para as demais operadoras.
3. Avaliar o mesmo tratamento em `TitulosList.tsx:411-413` se a exibição "envio —" confundir.

## Critérios de aceite

- Lotes AMHP-DF sem `dtaEnvio` não exibem o ícone "sem envio" nem entram na contagem do aviso.
- Lotes de outras operadoras sem `dtaEnvio` continuam avisando como hoje.

## Fora de escopo

- Preencher `DtaEnvio` no apLIS.
- Mudar a regra global de envio (ex.: considerar protocolo presente como enviado).
