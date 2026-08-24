Status: needs-triage
Type: task

# Títulos: status "sem envio" fica preso no snapshot da criação, não acompanha o apLIS

## Onde

- Snapshot gravado na criação do título: RPC `fat_criar_titulo` (`supabase/migrations/20260807130000_contas_receber_rpcs.sql:141`, `20260810140000_revisao_contas_receber_baixa_severidade.sql:157`, `20260819140000_fat_criar_titulo_codigo_requisicao.sql:102`) — grava `v_lote->>'dataEnvio'` na tabela `lotes` (coluna `data_envio`, `supabase/migrations/20260320_billing_module.sql:27`), a partir do payload que `api/_lib/handlers/faturamento-titulo-criar.ts` recebe do apLIS.
- Leitura/exibição: `hooks/useContasReceber.ts:75` (`dataEnvio: lote.data_envio`) e `components/TitulosList.tsx:401-418` (badge "envio {data}" por lote, dentro da expansão do título).
- Consulta ao vivo já existente no apLIS: `api/_lib/faturamento/bdLab.ts:467/501` (`DtaEnvio` por lote).

## Problema

O relatório do setor aponta os lotes 6607/6608 (Plan Assiste) como "não enviados" incorretamente. Verificado direto no apLIS (24/08): esses lotes **têm `DtaEnvio` preenchido** (21/08) — não é o caso da AMHP-DF (issue 03, que trata `DtaEnvio` nulo de fato). A causa é outra: `dataEnvio` do título vem de um **snapshot gravado uma única vez**, no momento em que o título foi criado. Se o título foi criado antes do apLIS preencher `DtaEnvio` (comum, já que o envio costuma acontecer depois do lote fechado), o snapshot fica desatualizado pra sempre — a tela nunca revalida contra o apLIS depois da criação.

## O que fazer

1. Ao exibir a expansão do título (lista de lotes, `TitulosList.tsx:401-418`), buscar o `dataEnvio` atual dos lotes envolvidos direto do apLIS (reaproveitando a consulta de `bdLab.ts`), em vez de usar só `lote.data_envio` do snapshot.
2. Cache curto (mesmo padrão de outras consultas do módulo, ex. 3 min) pra não sobrecarregar o MySQL de backup a cada expansão.
3. Se a consulta ao vivo falhar (túnel fora do ar, lote não encontrado), cair de volta pro valor do snapshot sem quebrar a tela.
4. Manter o `data_envio` do snapshot como estava (não precisa reescrever a tabela) — a mudança é só na exibição.

## Critérios de aceite

- Um lote cujo `DtaEnvio` foi preenchido no apLIS **depois** da criação do título deixa de aparecer como "sem envio" na expansão do título, sem precisar recriar o título.
- Lotes realmente sem `DtaEnvio` no apLIS (ex.: AMHP-DF, issue 03) continuam mostrando "sem envio" normalmente.

## Fora de escopo

- Revalidar outros campos do snapshot (status, valor, protocolo) ao vivo — só `dataEnvio`, que é o campo do sintoma relatado. Considerar separadamente se o mesmo problema aparecer em outro campo.
- Job periódico ou botão manual de resync do snapshot — descartado nesta sessão de grilling (24/08) em favor de revalidação ao vivo na leitura.

## Referência

Novo relatório de feedback do setor de faturamento (24/08), item 4.1 (exemplo: lotes 6607/6608 da Plan Assiste). Causa raiz investigada nesta sessão de grilling (24/08).
