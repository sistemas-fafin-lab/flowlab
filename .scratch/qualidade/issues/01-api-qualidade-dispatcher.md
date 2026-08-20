Status: done
Type: task

# API dispatcher e handlers de Qualidade (api/qualidade/[action].ts)

## Onde

`src/modules/qualidade/qualidadeApi.ts` (`chamarQualidadeApi`) já chama `/api/qualidade/{action}` para 9 ações, mas nenhuma delas existe neste repositório — não há `api/qualidade/[action].ts` nem `api/_lib/handlers/qualidade-*.ts`. Sem isso, os botões de sincronizar e as telas de Câncer/IHQ que dependem de API quebram.

## Ações que precisam de handler

- `sync-ocorrencias`
- `sync-cortesias`
- `sync-ihq`
- `sync-cancer`
- `confirmar-vinculo-ihq`
- `buscar-funil-cancer`
- `buscar-detalhe-cancer`
- `gerar-exportacao-cancer`
- `baixar-exportacao-cancer`

## O que fazer

1. Localizar o código-fonte original (provável repositório separado "flowlab-qualidade", mencionado nos comentários do módulo portado) — os handlers e a lógica de sincronização com o LIS provavelmente já existem lá, não precisam ser reescritos do zero.
2. Criar `api/qualidade/[action].ts` seguindo o padrão de dispatcher único usado por `faturamento`/`analises-clinicas` (ver `docs/agents` / skill `/add-module` passo 6) — conta como 1 function a mais no limite de 12 do Vercel Hobby (hoje em 7-8 em uso).
3. Handlers em `api/_lib/handlers/qualidade-*.ts`, cada um com seu próprio check de permissão (`canManageQualidade` para sync/geração/confirmação, no mínimo) — nada no dispatcher faz autorização.
4. `sync-*` usa `service_role` (bypassa RLS) para escrever o espelho; nunca deve tocar colunas de curadoria (ver os triggers de auditoria em `supabase/migrations/20260820{120000,130000,140000,150000}_qualidade_*.sql`, que só disparam quando colunas de curadoria mudam).

## Critérios de aceite

- Os 4 submódulos (Ocorrências, Cortesias, IHQ, Câncer) sincronizam e a UI não quebra ao clicar em "Sincronizar".
- Câncer carrega funil e detalhe de caso sem erro 404.

## Comments

Implementado: `api/qualidade/[action].ts` (dispatcher), `api/_lib/qualidade/autorizacao.ts`,
`api/_lib/qualidade/bdLabQualidade.ts` (consultas ao MySQL do laboratório, mapeamento de
tabelas conferido contra `import_files/schema-backup-banco.csv`), `api/_lib/qualidade/
cancerRegras.ts`/`cortesiasRegras.ts`/`ihqRegras.ts`, e os 12 handlers em `api/_lib/handlers/
qualidade-*.ts` (as 9 ações listadas acima + `buscar-pii-cortesias`/`buscar-pii-ihq`/
`buscar-detalhe-ihq`, que `qualidadeApi.ts` também chama mas não estavam listadas aqui).

Dois pontos ficam documentados como best-effort no cabeçalho de `bdLabQualidade.ts` (sem
tabela de catálogo no schema para confirmar):
- Cortesias: qual `requisicaoautorizacao.Tipo` identifica especificamente uma autorização de
  CORTESIA — configurável via `APLIS_CORTESIA_TIPO_AUTORIZACAO` (opcional); sem essa env, o
  sync traz todas as autorizações do período e a curadoria descarta o que não for cortesia.
- Ocorrências: catálogo de descrição para `ocorrencia.Origem` não localizado —
  `categoria_origem_lis` sai sempre `null`/`categoria_origem_generica` sempre `true`.

IHQ: identificação de "isto é uma solicitação de IHQ" é heurística (`evento.DesEvento LIKE
'%IHQ%'`), sem flag direta no schema.

Câncer: `api/_lib/qualidade/cancerRegras.ts` foi implementado direto contra o contrato já
fixado em `src/modules/qualidade/domain/cancerRegras.test.ts`, o que também resolve a issue
`02-cancer-regras-arquivo-faltando.md` como efeito colateral. Layout do CSV de exportação RHC
(`gerar-exportacao-cancer`) é provisório — nenhum data dictionary oficial foi localizado neste
repositório (ver aviso no próprio handler).
