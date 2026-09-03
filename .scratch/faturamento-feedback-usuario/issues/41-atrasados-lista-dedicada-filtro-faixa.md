Status: needs-triage
Type: feature

# Lista dedicada de atrasados/>90 dias (o widget de aging é só gráfico, sem drill-down)

## Onde

`src/modules/faturamento/components/ContasReceberDashboard.tsx:608-641`
(widget "Aging da carteira", gráfico de barras empilhadas por faixa
`d0_30`...`d90_mais`), `src/modules/faturamento/components/TitulosList.tsx:101-115`
(badge `diasAtraso` por linha, já existe mas sem filtro dedicado),
`src/modules/faturamento/components/FiltrosReceber.tsx` (sem filtro de faixa
de atraso).

## Contexto

Pedido explícito e repetido na transcrição: **"não pode ser só gráfico"** —
a usuária precisa de uma lista detalhada (quais operadoras, quais títulos)
por trás do agregado, com filtros e busca, especificamente para cobrança de
atraso (inclusive >90 dias). Hoje o widget "Aging da carteira" é só um
gráfico agregado por faixa, sem clique/drill-down para lista, e não existe
nenhum filtro de faixa/dias de atraso em `FiltrosReceber.tsx` (confirmado por
leitura completa do arquivo). A lista de Títulos já tem o dado (`diasAtraso`
por linha), só falta expor como filtro dedicado.

## O que fazer (a decidir na triagem)

Duas abordagens possíveis, a escolher:

1. **Reaproveitar a lista de Títulos**: adicionar filtro de faixa de atraso
   (ex.: "0-30", "31-60", "61-90", "90+") em `FiltrosReceber.tsx`/
   `TitulosList.tsx`, já ordenando por `diasAtraso` desc quando ativo.
2. **Drill-down do widget de aging**: clicar numa barra do gráfico
   (`ContasReceberDashboard.tsx`) navega para Títulos já com o filtro de
   faixa correspondente pré-aplicado (via querystring/estado compartilhado).

A opção 2 cobre melhor "cobrança e atraso" como fluxo (parte do pedido P0
"Cobrança/Atraso" do levantamento), mas depende da opção 1 existir primeiro
(precisa do filtro de faixa na lista para o drill-down ter onde cair).

## Critérios de aceite (provisórios, ajustar na triagem)

- É possível ver uma lista de títulos com atraso, filtrada por faixa
  (incluindo especificamente >90 dias), sem depender só do gráfico agregado.
- A lista mostra operadora, valor e dias de atraso por item.

## Referência

Levantamento de requisitos com a usuária do setor (áudio transcrito,
2026-09-03), itens "Data prevista/programada para pagamento (cobrança e
atraso)" e "Não pode ser só gráfico".
