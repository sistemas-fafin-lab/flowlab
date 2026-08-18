Status: ready-for-agent
Type: task

# Títulos: indicar mudança de status ao longo do tempo (número de NF "semelhante" entre status)

## Onde

Não existem abas Recebidos/Parcial/Aberta — o status é filtro dropdown em `TitulosList.tsx:31-48` (`useContasReceber.ts:156-162` faz `.eq('status', status)`). Coluna "Nota" mostra `titulo.numeroNota` (`TitulosList.tsx:293,318-320`). `notas.numero_nota` não tem UNIQUE (`supabase/migrations/20260320_billing_module.sql:76`).

## Problema

Feedback: "ao consultar as opções Recebidos, Parcial e Aberta, o número da nota fiscal apresenta informações semelhantes". Hipóteses: (a) títulos distintos com o mesmo `numero_nota` em status diferentes; (b) percepção de coluna NF sem contexto (competência/operadora); (c) transição de status confundindo (a mesma NF move de status conforme baixas chegam).

## Achado (verificado em 2026-08-18, no Supabase real de produção)

O `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` deste `.env` é o banco de produção do próprio flowlab (não é seed/dev, como eu tinha suposto antes por engano). A tabela `notas` hoje tem só **7 linhas no total**, todas com `numero_nota` distinto — nenhuma duplicidade de fato agora. O recurso de Títulos/Contas a Receber é recente (poucos títulos criados até aqui), então o volume ainda é baixo demais para reproduzir "duplicidade" olhando só o estado atual.

Também descartei a hipótese (b): a tabela em `TitulosList.tsx:293-295` já mostra Operadora e Competência em colunas ao lado de "Nota" — não é falta de contexto na coluna.

**Assumindo a hipótese (c) como verdadeira** (a decidir/confirmar — reverter esta issue para investigação se não for): com só 7 títulos no sistema, o setor revisitou os mesmos poucos títulos em dias diferentes durante os testes e viu o status do mesmo título mudar (Aberta → Parcial → Recebido) conforme as baixas chegavam, dando a impressão de "a mesma NF aparecendo em vários status" — não é duplicidade de `numero_nota`, é o funcionamento normal do título sem indicação de quando/por que mudou.

## O que fazer

1. Indicar na linha do título (ou na expansão) a data da última mudança de status — ex.: coluna/tooltip "Status atualizado em `updated_at`" (já existe na tabela `notas`, só não é exibido).
2. Se fizer sentido para o fluxo, expor o histórico simplificado de status do título (quando abriu, quando ficou parcial, quando ficou recebido) na expansão do título, usando `DtaRecebido` das requisições/guias vinculadas.
3. Sem mudança de regra de negócio — é só tornar visível a transição de status que já acontece, para não parecer duplicidade.

## Critérios de aceite

- Ao ver um título, dá para saber quando o status atual foi atingido, sem precisar comparar com uma consulta anterior de memória.

## Se a hipótese (c) não se confirmar

- Reverter para `research`: pedir exemplo concreto de duas NFs "iguais" e investigar duplicidade real de `numero_nota` (regra de unicidade por operadora+competência, flag de duplicidade).

## Referência

Feedback do setor, item 4. `fat_criar_titulo` não deduplica por `numero_nota`.
