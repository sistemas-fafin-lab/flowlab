Status: needs-info
Type: task

# Títulos: atalho de período (mês/trimestre) — confirmar campo de referência antes de implementar

## Onde

`src/modules/faturamento/components/TitulosList.tsx:256-271` (range livre
"Emissão de/até"), `src/modules/faturamento/hooks/useContasReceber.ts:198-199`
(`.gte/.lte('data_emissao', ...)`).

## Contexto

O período hoje é um range de datas livre, sem atalho de mês/trimestre, e
filtra por `data_emissao` (data de emissão da NF/título) — não por vencimento
nem por data de pagamento efetivo. A usuária pediu um atalho rápido de
mês/trimestre, mas o levantamento de requisitos deixou em aberto **qual data
deveria ser essa referência** (pergunta textual da própria transcrição):

> O "período" principal será filtrado por: data prevista de pagamento, data
> de emissão da NF, ou competência do faturamento?

Não dá para decidir isso por leitura de código — é escolha do setor sobre o
que "período" significa operacionalmente pra eles (ex.: "quanto recebi em
agosto" pode significar "NFs emitidas em agosto" ou "o que efetivamente
foi pago em agosto", que são coisas diferentes quando um título de julho é
pago em setembro).

## Pergunta para o setor

Qual data deve ser a referência do filtro de período mês/trimestre:
**data de emissão da NF** (comportamento atual), **vencimento/data prevista
de pagamento**, ou **competência** (campo já existente no título,
`titulos.competencia`)?

## O que fazer (após resposta)

Adicionar atalhos de mês/trimestre (ex.: "Este mês", "Mês passado", "Este
trimestre") que preenchem o range de datas existente, usando o campo de
referência confirmado pelo setor. Se a resposta for "competência" (que é
texto livre tipo "2026-08", não uma data), o filtro precisa mudar de range de
data para seleção de competência(s) — desenho diferente do atual.

## Referência

Levantamento de requisitos com a usuária do setor (áudio transcrito,
2026-09-03), seção "Decisões a confirmar", item 1.
