# 02 — Riscos: gerenciamento (tratamento, plano de ação, reavaliação, eficácia)

**What to build:** um usuário abre um risco já cadastrado, define o
tratamento (Aceitar/Monitorar/Reduzir/Eliminar/Transferir), cria um ou mais
planos de ação (ação, responsável, datas, status, evidência anexada),
reavalia o risco e vê o risco inicial × residual lado a lado (histórico
completo, nunca sobrescrevendo o registro inicial), e marca cada plano de
ação como eficaz ou não — quando não eficaz, abre um novo plano vinculado ao
anterior, permitindo ciclos iterativos até o risco ficar sob controle.

Eficácia vive como colunas dentro do próprio plano de ação (`eficaz`,
`avaliado_em`, `avaliado_por`, `observacao_eficacia`), não uma tabela à
parte — é sempre 1:1 com um plano específico. Anexos (evidência) usam um
bucket de storage dedicado.

Referência de implementação completa: projeto de origem
`Flowlab_Controle_Qualidade`, branch `main`, commit `d78e375` —
`components/riscos/RiscoDetalheDrawer.tsx` (a maior parte da UI de
gerenciamento), tabelas `qa_planos_acao`/`qa_reavaliacoes_risco` em
`qualidade_riscos_schema.sql`.

**Blocked by:** 01.

**Status:** done

- [x] Reavaliar um risco nunca sobrescreve o registro inicial — cria nova
      linha de histórico com score/classificação residual.
- [x] Um risco pode ter mais de um plano de ação (não é campo único).
- [x] Marcar um plano como "não eficaz" oferece criar o próximo plano
      vinculado ao anterior, sem perder o histórico do ciclo anterior.
- [x] Evidência de plano de ação pode ser anexada e recuperada depois.
- [x] `npx tsc --noEmit` e `npm test` sem erros novos.

## Comments

Implementado em `RiscoDetalheDrawer.tsx` (`SecaoTratamento`, `SecaoReavaliacao`,
`SecaoPlanosAcao`) + migration `20260831180000_qualidade_riscos_gerenciamento.sql`
(`qa_reavaliacoes_risco` sem policy de UPDATE/DELETE, `qa_planos_acao` com
`plano_anterior_id` encadeando ciclos, bucket `qa-riscos-evidencias`). Ciclos
de plano de ação montados via `domain/riscosGerenciamento.ts`
(`agruparCiclosPlanoAcao`/`pontaDoCiclo`), com teste próprio
(`riscosGerenciamento.test.ts`). Conferido em 2026-09-01: `npx tsc --noEmit`
sem erros novos no módulo qualidade e `npx vitest run src/modules/qualidade`
com 87 testes passando.
