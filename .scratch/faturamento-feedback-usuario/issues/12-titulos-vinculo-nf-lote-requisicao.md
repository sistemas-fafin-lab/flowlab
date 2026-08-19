Status: done
Type: task

# Títulos: vínculo NF → lote → requisição do Aplis

## Achado (verificado em código, 2026-08-19 — não depende de volume real de títulos)

A ressalva original ("esperar título real pra confirmar campos") não se sustenta: dá pra responder lendo o código, sem precisar de dado de produção.

- `fat_criar_titulo` (`supabase/migrations/20260807130000_contas_receber_rpcs.sql:167-180`): o snapshot da guia grava `numero_guia`, `data_criacao`/`data_execucao`, `valor`, `paciente_nome`, `procedimento_codigo`/`procedimento_descricao`, `aplis_id` — **não grava `codigo_requisicao`**.
- `api/_lib/handlers/faturamento-titulo-criar.ts:87`: o handler já tem `req.codRequisicao` disponível (vem do apLIS), mas hoje só usa como fallback dentro de `numeroGuia` (`numGuiaConvenio ?? numGuia ?? codRequisicao ?? 'sem-guia'`) — o campo em si é descartado, não é propagado como campo próprio no payload.

Ou seja, o dado já flui até o handler — só não é persistido separadamente. Não falta pesquisa, falta implementar o encanamento.

## Onde

`src/modules/faturamento/components/TitulosList.tsx` — expansão título → lote → guias (`:411-449`); tipos `TituloGuia` em `src/modules/faturamento/types/index.ts:181+`; snapshot criado por `fat_criar_titulo` (`supabase/migrations/20260807130000_contas_receber_rpcs.sql:167-180`); payload montado por `api/_lib/handlers/faturamento-titulo-criar.ts:87`; tabela `requisicoes` (Supabase).

## O que fazer

1. Adicionar `codigo_requisicao` como campo próprio no payload de `api/_lib/handlers/faturamento-titulo-criar.ts` (hoje `req.codRequisicao` só cai dentro de `numeroGuia` como fallback — passar também como campo separado).
2. Nova coluna `codigo_requisicao` na tabela `requisicoes` (Supabase) — migration.
3. `fat_criar_titulo` passa a persistir esse campo no `INSERT`/`ON CONFLICT DO UPDATE` do snapshot de guia.
4. Expor a coluna no tipo `TituloGuia` (`types/index.ts:181+`) e exibir na expansão do título em `TitulosList.tsx`, junto com lote (código) e requisição.
5. Títulos antigos (criados antes dessa mudança) não têm o campo — exibir como indisponível, sem quebrar a expansão.

## Critérios de aceite

- A partir de um título, o operador identifica NF, lote e cada requisição no apLIS (via `codigo_requisicao`) sem abrir outro sistema/planilha.
- Títulos criados antes da mudança mostram "indisponível" no lugar do código da requisição, sem erro.
