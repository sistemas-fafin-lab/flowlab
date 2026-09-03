Status: ready-for-agent
Type: task

# Filtro de Operadora em Títulos esconde fontes com título real só por não estarem na whitelist de meta

## Onde

`src/modules/faturamento/components/TitulosList.tsx:289` (select de
Operadora filtra a lista de opções por `operadora.consideradaMeta`).

## Contexto

Issue 36 introduziu `operadoras.is_considerada_meta` como whitelist para o
**relatório de meta** (Dashboard de Contas a Receber, Pendências, Faturas,
Glosas/Recursos legado). O comentário da própria issue 36 justifica restringir
os dropdowns de operadora nessas telas "para evitar o operador escolher uma
fonte que o backend devolveria vazia" — correto quando a tela em si já filtra
por `consideradaMeta` no backend.

Mas a lista de **Títulos** não filtra por `consideradaMeta` no backend (título
é lançamento manual do setor, não uma agregação de meta) — é a NF emitida
contra qualquer operadora, dentro ou fora da whitelist. Restringir o dropdown
de Operadora nessa tela some do filtro qualquer fonte pagadora que tenha
título real cadastrado mas não esteja marcada para meta — o usuário não
consegue filtrar por essa operadora mesmo com dados existindo.

## O que fazer

Em `TitulosList.tsx`, popular o select de Operadora a partir das operadoras
que de fato têm título cadastrado (ou a lista completa de operadoras ativas),
sem o filtro `consideradaMeta`. Não mexer nos outros 4 lugares que a issue 36
já cobriu de propósito (Dashboard, Pendências não faturadas, Pendências sem
lote, seleção múltipla de `FiltrosReceber`) — só a tela de Títulos, que não
tem filtro de whitelist no backend.

## Critérios de aceite

- Uma operadora com título cadastrado aparece no filtro de Títulos
  independente de `is_considerada_meta`.
- Os outros 4 dropdowns cobertos pela issue 36 continuam restritos à
  whitelist (sem regressão).

## Referência

Investigação de 2026-09-03, comparando a lista de Títulos com o requisito
"Convênio/Operadora/Fonte pagadora" do levantamento de requisitos com a
usuária do setor (áudio transcrito, reunião Gabriel↔Raquel).
