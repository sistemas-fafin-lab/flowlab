# 01 — Riscos: cadastro, matriz configurável e origem por ocorrência

**What to build:** um usuário da Qualidade cadastra um risco operacional
(setor, processo, risco identificado, causa, consequência, controle
existente) escolhendo probabilidade × severidade numa matriz 5×5 clicável, e
o sistema calcula score e classificação (Baixo/Médio/Alto/Crítico) a partir
de faixas configuráveis (não fixas no código). O mesmo cadastro também pode
nascer **a partir de uma ocorrência existente**: um botão "Gerar risco a
partir desta ocorrência" em Ocorrências abre o formulário já pré-preenchido
(setor/descrição/data/origem) e grava o vínculo de origem — o usuário só
completa probabilidade, impacto e o resto do cadastro.

Dado é nativo do Supabase (sem sync com o LIS/MySQL, diferente das demais
abas de Qualidade). Faixas de classificação configuráveis vivem em
`qa_parametros` (seed: 1-4 baixo, 5-9 médio, 10-16 alto, 17-25 crítico),
mesmo mecanismo já usado pelos parâmetros fixos de Câncer. Toda mudança é
auditada via trigger (diferente de Ocorrências, que só audita curadoria —
aqui não existe distinção espelho/curadoria). Vocabulário de setor reaproveita
`qa_setores`; `processo` é texto livre com sugestão pelos valores já usados
no mesmo setor.

Referência de implementação completa (para não reinventar o desenho):
projeto de origem `Flowlab_Controle_Qualidade`, branch `main`, commit
`d78e375` — `riscos.ts`, `domain/riscosClassificacao.ts`,
`components/RiscosPage.tsx`, `components/riscos/NovoRiscoDrawer.tsx`,
`components/riscos/SeletorMatrizRisco.tsx`, migrations
`qualidade_riscos_schema.sql` e `qualidade_riscos_parametros_storage.sql`.
Conferir se `qa_setores`/`qa_parametros`/`qa_auditoria`/
`qualidade_usuario_tem_acesso()` neste repo têm exatamente os mesmos
nomes/assinatura antes de copiar o SQL — pode ter divergido desde o fork.

**Blocked by:** 00.

**Status:** done

- [x] Cadastrar um risco manualmente calcula score (`probabilidade *
      severidade`) e classificação corretas para as 4 faixas-padrão.
- [x] Faixas de classificação são lidas de `qa_parametros` e editáveis sem
      deploy.
- [x] Botão "Gerar risco a partir desta ocorrência" em Ocorrências abre o
      cadastro pré-preenchido e grava `ocorrencia_origem_id` (FK nullable,
      imutável após criado).
- [x] Toda mudança em `qa_riscos` gera linha em `qa_auditoria`.
- [x] `npx tsc --noEmit` e `npm test` sem erros novos.

## Comments

Implementado escopado só ao que esta issue pede — o desenho de origem
(`d78e375` de `Flowlab_Controle_Qualidade`) tinha as 5 tabelas do módulo
Riscos numa única migration; aqui a migration nova
(`supabase/migrations/20260831170000_qualidade_riscos_schema.sql`) cria só
`qa_riscos` (cadastro), deixando `qa_planos_acao`/`qa_reavaliacoes_risco`
(issue 02) e `qa_planos_contingencia`/`qa_testes_contingencia` (issue 03)
para suas próprias migrations — fatias verticais, conforme spec.md.

Divergência confirmada e ajustada em relação ao repo de origem: lá o acesso é
por `qualidade_usuario_tem_acesso()` (`department = 'Qualidade'`); neste repo
o módulo Qualidade já usa `current_user_has_permission('canViewQualidade' |
'canManageQualidade')` (mesmo padrão de `qa_ocorrencias`/`qa_cortesias`) — a
RLS de `qa_riscos` segue esse padrão local. `qa_setores`/`qa_parametros`/
`qa_auditoria` têm os mesmos nomes/colunas nos dois repos, então o resto do
SQL foi portado quase 1:1. A policy de leitura de `qa_parametros` (já
restrita por prefixo de `chave`) ganhou `riscos.%` ao lado de `cancer.%`/
`ihq.%`.

Frontend: `riscos.ts` (client de dados supabase-js direto, sem sync/handler
serverless — mesmo padrão de Ocorrências pós-`spa-sem-backend-express`),
`domain/riscosClassificacao.ts` (porção pura de classificação — só
`classificarScore`/`faixasSaoValidas`/`resolverFaixasClassificacao`, sem
`derivarStatusTratamento`, que depende de `PlanoAcaoDTO` da issue 02),
`components/riscos/{SeletorMatrizRisco,NovoRiscoDrawer,rotulos}.tsx` e
`RiscosPage.tsx` (lista + cadastro, sem drawer de detalhe/tratamento — isso é
issue 02). `NovoRiscoDrawer` usa `DrawerLateral` (convenção deste repo) em
vez do portal cru do repo de origem.

Botão "Gerar risco a partir desta ocorrência" entra em `CuradoriaDrawer.tsx`
(Ocorrências) construindo o pré-preenchimento a partir do próprio estado do
formulário (setor já selecionado na tela, mesmo sem "Concluir curadoria"
salvo) em vez de reler `qa_ocorrencias` do banco — achado em `/code-review`:
reler do banco falhava com um erro confuso se o usuário clicasse o botão
antes de salvar a curadoria. Não implementa a correlação N:N com Ocorrências
(`qa_riscos_ocorrencias`) — isso é escopo da issue 05, distinto do vínculo de
origem 1:N (`ocorrencia_origem_id`) que é o desta issue.

`npx tsc --noEmit` (sem erros novos — os 46 pré-existentes são de
`src/pages/IT/ITProjectMindMap.tsx`/`MindMapNodes.tsx`, não relacionados),
`npx vitest run` (234 testes) e `npm run build` sem regressões. `/code-review`
revisou o diff e apontou 2 correções de correlação (trava de `origem_risco`
quando pré-preenchido por ocorrência; leitura do setor do formulário local em
vez do banco) e 2 simplificações (paralelizar a query de faixas com
`Promise.all`; derivar a lista de origens de `ROTULO_ORIGEM`), todas
aplicadas. Não foi possível testar a UI num navegador real porque a migration
ainda não foi aplicada em nenhum ambiente (banco de teste não tem `qa_riscos`
ainda) — só `npx tsc --noEmit`/`vitest`/`vite build` foram verificados.
