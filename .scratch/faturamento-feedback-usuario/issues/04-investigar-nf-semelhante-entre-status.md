Status: ready-for-agent
Type: research

# Investigar: número de NF "semelhante" entre os status de títulos

## Onde

Não existem abas Recebidos/Parcial/Aberta — o status é filtro dropdown em `TitulosList.tsx:31-48` (`useContasReceber.ts:156-162` faz `.eq('status', status)`). Coluna "Nota" mostra `titulo.numeroNota` (`TitulosList.tsx:293,318-320`). `notas.numero_nota` não tem UNIQUE (`supabase/migrations/20260320_billing_module.sql:76`).

## Problema

Feedback: "ao consultar as opções Recebidos, Parcial e Aberta, o número da nota fiscal apresenta informações semelhantes". Hipóteses: (a) títulos distintos com o mesmo `numero_nota` em status diferentes; (b) percepção de coluna NF sem contexto (competência/operadora); (c) transição de status confundindo (a mesma NF move de status conforme baixas chegam).

## O que investigar

1. No banco real (Supabase do cliente): agrupar `notas` por `numero_nota` com mais de um título e conferir status/operadora/competência.
2. Confirmar com quem reportou um exemplo concreto.
3. Propor: regra de unicidade (ex.: UNIQUE por operadora+competência), flag de duplicidade, e/ou melhoria da coluna (NF + operadora + competência).

## Referência

Feedback do setor, item 4. `fat_criar_titulo` não deduplica por `numero_nota`.
