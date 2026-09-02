# 06 — Indicadores: sync de Requisições + aba com 5 seções

**What to build:** um usuário abre a nova sub-aba "Indicadores"
(`/qualidade/indicadores`) e vê a seção "Indicadores Gerais do Laboratório"
com 8 métricas calculadas — Amostras Recebidas, Laudos Liberados, Laudos
Liberados por Médico (patologista), Amostras Admitidas, TAT médio, Laudos
Fora do Prazo, Não Conformidades por Setor (reaproveitando o indicador já
existente de Ocorrências) e Laudos Retificados — mais 4 seções adicionais
(Biologia Molecular, Patologia/Anatomia Patológica, Histologia/Citologia,
Imuno-histoquímica/parceiro). O usuário também cura manualmente o motivo de
um laudo retificado (mesmo padrão de curadoria já usado em Ocorrências),
porque esse dado não existe estruturado no LIS.

Os dados vêm de um novo espelho `qa_requisicoes`, sincronizado
automaticamente do MySQL de backup do LIS (tabelas `requisicao`/
`requisicaohistorico`), seguindo o mesmo padrão de sync já usado por
Ocorrências/Câncer/IHQ/Cortesias neste módulo. Reaproveita `PeriodoProvider`
e as permissões (`department = 'Qualidade'`) já existentes — sem mudança de
autenticação/autorização. Módulo inteiramente independente de Riscos — não
compartilha schema nem UI com as tickets 00-05.

Referência de implementação completa: projeto de origem
`Flowlab_Controle_Qualidade`, branch `main`, commit `cd932b3` (superset de
`d78e375` — inclui um fix de correção pós-entrega, ver abaixo) —
`api/_lib/qualidade/bdLabRequisicoes.ts`,
`api/_lib/qualidade/handlers/sync-requisicoes.ts`,
`src/modules/qualidade/requisicoes.ts`,
`components/indicadores/IndicadoresPage.tsx`, domains
`biologiaMolecularIndicadores.ts`, `patologiaIndicadores.ts`,
`histologiaCitologiaIndicadores.ts`, `ihqParceiroIndicadores.ts`,
`requisicoesIndicadores.ts` (cada um com teste próprio), migrations
`qualidade_requisicoes_schema.sql`,
`qualidade_requisicoes_patologia_ap.sql`,
`qualidade_requisicoes_histologia_citologia.sql`,
`qualidade_requisicoes_ihq_parceiro.sql`. Conferir se as 4 seções extra já
saíram do estágio "em breve" no código de origem antes de assumir escopo —
a proposta original as descreve como placeholder, mas o commit final inclui
domain + testes completos para as 4.

**Já implementado neste repo** — commit `a660523` (01/09), antes do fix
pós-entrega abaixo ter sido publicado no projeto de origem.

⚠️ **Bug herdado, ainda presente aqui — carece de fix próprio (não
"portar", já está em produção deste repo):** o projeto de origem corrigiu em
`5aa8d90` (02/09) a resolução do patologista — `requisicao.IdPatologista`
aponta para `autusuario.IdUsuario` (usuário interno que libera o laudo),
**não** para `medico.CodMedico`. As duas tabelas têm sequências de
auto-incremento independentes que colidem por coincidência — o JOIN em
`medico` "acerta" um nome plausível, porém de pessoa errada, na maioria dos
IDs (confirmado contra o Aplis: `IdPatologista=196` é Larissa Sena Teixeira
Mendes em `autusuario`, mas `medico.CodMedico=196` é uma pessoa
completamente diferente).

Como a `06` foi implementada em 01/09, **antes** desse fix existir a
montante, `api/_lib/qualidade/bdLabQualidade.ts` deste repo trouxe o mesmo
bug — confirmado ao ler o código: `listarRequisicoesLis` (usada pela métrica
"Laudos Liberados por Médico") tem `LEFT JOIN medico med ON med.CodMedico =
r.IdPatologista` (~linha 738). O mesmo padrão também aparece em
`buscarDetalheCancerLis`/`buscarDetalhesCancerLis` (~linhas 448, 492),
fora do escopo desta issue (módulo Câncer), mas mesma causa raiz — vale um
fix único cobrindo as 3 ocorrências.

Contexto à parte (não ação para este repo): o `Flowlab_Controle_Qualidade`
publicou em `supabase/scripts/fix-qa-requisicoes-schema-teste.sql`
(commit `cd932b3`) um script para corrigir um `qa_requisicoes` divergente
criado manualmente no banco de TESTE de origem — não se aplica aqui, pois
este repo criou sua própria `qa_requisicoes` do zero pelas 4 migrations
acima, sem esse drift.

**Blocked by:** None.

**Status:** done — reabrir/desdobrar como fix se o time confirmar o bug do
patologista acima.

- [x] Sync de `qa_requisicoes` é idempotente (rodar duas vezes não duplica
      linhas).
- [x] As 8 métricas de "Indicadores Gerais" batem com dados de teste
      conhecidos, calculadas via módulo de domínio (não hardcoded na
      página).
- [x] Curadoria de motivo de retificação persiste e aparece na leitura
      seguinte.
- [ ] **Pendente (bug herdado):** patologista resolvido via
      `autusuario.IdUsuario`, não `medico.CodMedico` — fix ainda não
      aplicado neste repo, ver nota acima.
- [x] `npx tsc --noEmit` e `npm test` sem erros novos.
