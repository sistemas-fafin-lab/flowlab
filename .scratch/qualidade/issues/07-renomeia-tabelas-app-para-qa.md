Status: done
Type: chore

# Renomeia app_auditoria/app_parametros/app_setores/app_colaboradores para o prefixo qa_

## Onde

4 tabelas usadas pelo módulo Qualidade tinham prefixo `app_` em vez do `qa_` usado pelo
resto do módulo (`qa_ocorrencias`, `qa_cortesias`, `qa_ihq_solicitacoes`, `qa_cancer_casos`
etc.): `app_auditoria`, `app_parametros`, `app_setores`, `app_colaboradores`. Resquício de
quando o módulo era um app standalone (flowlab-qualidade) — lá, "app_" fazia sentido (era o
app inteiro). Portado pra dentro do monorepo do FlowLab, esse prefixo passa a impressão
errada de tabela genérica/compartilhada entre módulos.

Confirmado por busca em todo o repositório: nenhum outro módulo do FlowLab (faturamento,
análises clínicas, IT, quotations etc.) referencia essas 4 tabelas — são usadas
exclusivamente por `src/modules/qualidade/` e `api/_lib/handlers/qualidade-*`.

## O que foi feito

Como nenhuma das 6 migrations pendentes do módulo (`20260820120000` a `20260821090000`)
tinha sido aplicada em ambiente nenhum ainda (confirmado via `supabase migration list` contra
produção — coluna Remote vazia para todas), deu pra editar os arquivos de migration direto em
vez de escrever uma migration de rename separada:

1. `20260820120000_qualidade_ocorrencias_piloto.sql`: adicionado
   `ALTER TABLE IF EXISTS app_auditoria/app_parametros/app_setores RENAME TO qa_auditoria/
   qa_parametros/qa_setores` logo após o `BEGIN`, antes de qualquer outra coisa no arquivo
   (`IF EXISTS` torna idempotente). Todo o resto do arquivo (FKs, policies, trigger) já
   referencia os nomes novos.
2. `20260820130000_qualidade_cortesias_piloto.sql`: mesmo tratamento para
   `app_colaboradores` → `qa_colaboradores`.
3. `20260820140000_qualidade_ihq_piloto.sql` e `20260820150000_qualidade_cancer_piloto.sql`:
   só referenciavam `app_auditoria` (via `INSERT INTO` do trigger de auditoria) — trocado
   para `qa_auditoria` sem precisar de rename próprio (a tabela já foi renomeada pela
   migration de Ocorrências, que roda primeiro por causa do timestamp).
4. Todo o código de aplicação atualizado (`ocorrencias.ts`, `cortesias.ts`, `ihq.ts`,
   `cancer.ts`, `cancerConsulta.ts`, `types.ts`, `ExportacaoRhcCard.tsx`,
   `CampoParametroFixo.tsx`, `qualidade-sync-ihq.ts`, `qualidade-sync-cortesias.ts`,
   `qualidade-buscar-detalhe-ihq.ts`, `qualidade-confirmar-vinculo-ihq.ts`) — só troca de
   string literal (nome de tabela em `.from()`/embed do PostgREST), nenhuma mudança de
   lógica.

## Critérios de aceite

- `npx tsc --noEmit` (app e api) sem erros novos.
- `npx vitest run src/modules/qualidade` verde.
- Nenhuma referência a `app_setores`/`app_parametros`/`app_auditoria`/`app_colaboradores`
  sobra em `src/`, `api/` ou `supabase/migrations/` fora dos comentários explicativos do
  rename nas 2 migrations que o fazem.

Verificado: `tsc --noEmit` limpo (api e app — os erros do app são os 25 pré-existentes de
`src/components/IT/`, não relacionados); `npx vitest run src/modules/qualidade` 30/30.

## Comments

Logo em seguida, as 6 migrations pendentes do módulo (as 4 citadas acima + a do bucket de
Storage `20260820160000` + a da função `qualidade_registrar_exportacao_rhc`,
`20260821090000`) foram consolidadas num arquivo só,
`20260820120000_qualidade_piloto.sql` (mantém o timestamp mais antigo do grupo), a pedido do
usuário. Só foi possível porque nenhuma das 6 tinha sido aplicada em ambiente nenhum ainda —
confirmado antes via `supabase migration list` contra produção. O conteúdo SQL de cada uma
foi preservado literalmente (conferido por diff ignorando comentários/linhas em branco —
nenhuma statement foi perdida, alterada ou reordenada entre arquivos), só agrupado em
PARTE A (Ocorrências) a PARTE F (função RPC) dentro de um único `BEGIN;`/`COMMIT;` — o
deploy inicial do módulo vira atômico (tudo ou nada) em vez de 6 passos separados.
