Status: needs-info
Type: task

# Títulos: vínculo NF → lote → requisição do Aplis

## Adiada (2026-08-18)

Esta melhoria enriquece a expansão de um título **já criado** (`TitulosList.tsx:411-449`), a partir do snapshot que `fat_criar_titulo` grava no Supabase. Em produção só existem 5 notas, todas de uma carga de seed (mesmo achado das issues 01/05/06) — nenhuma criada organicamente pelo setor ainda. Não há título real hoje pra essa navegação melhorada valer a pena testar/usar.

**Retomar quando**: o setor começar a criar títulos de verdade pelo fluxo "Novo título". Nesse momento, confirmar quais campos o snapshot já captura versus o que falta (`CodRequisicao` etc.) antes de implementar.

## Onde

`src/modules/faturamento/components/TitulosList.tsx` — expansão título → lote → guias (`:411-449`); tipos `TituloGuia` em `src/modules/faturamento/types/index.ts:181+`; snapshots criados por `fat_criar_titulo` (`supabase/migrations/20260807130000_contas_receber_rpcs.sql`).

## O que fazer

1. Levantar quais campos do apLIS o snapshot de guia guarda hoje (ex.: `numeroGuia` = `NumGuiaConvenio`) e o que falta para o setor localizar a requisição no apLIS (ex.: `CodRequisicao`).
2. Garantir que a expansão mostre NF → lote (código) → requisições com número identificável no apLIS; adicionar colunas que faltem (código da requisição, data, valor).
3. Se necessário, ampliar o snapshot (`fat_criar_titulo`) e a tabela `requisicoes` para incluir `CodRequisicao`; para títulos antigos, indicar dados indisponíveis sem quebrar.

## Critérios de aceite

- A partir de um título, o operador identifica NF, lote e cada requisição no apLIS sem abrir outro sistema/planilha.
