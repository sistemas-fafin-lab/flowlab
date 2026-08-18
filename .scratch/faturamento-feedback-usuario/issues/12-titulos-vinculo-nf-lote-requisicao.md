Status: ready-for-agent
Type: task

# Títulos: vínculo NF → lote → requisição do Aplis

## Onde

`src/modules/faturamento/components/TitulosList.tsx` — expansão título → lote → guias (`:411-449`); tipos `TituloGuia` em `src/modules/faturamento/types/index.ts:181+`; snapshots criados por `fat_criar_titulo` (`supabase/migrations/20260807130000_contas_receber_rpcs.sql`).

## O que fazer

1. Levantar quais campos do apLIS o snapshot de guia guarda hoje (ex.: `numeroGuia` = `NumGuiaConvenio`) e o que falta para o setor localizar a requisição no apLIS (ex.: `CodRequisicao`).
2. Garantir que a expansão mostre NF → lote (código) → requisições com número identificável no apLIS; adicionar colunas que faltem (código da requisição, data, valor).
3. Se necessário, ampliar o snapshot (`fat_criar_titulo`) e a tabela `requisicoes` para incluir `CodRequisicao`; para títulos antigos, indicar dados indisponíveis sem quebrar.

## Critérios de aceite

- A partir de um título, o operador identifica NF, lote e cada requisição no apLIS sem abrir outro sistema/planilha.
