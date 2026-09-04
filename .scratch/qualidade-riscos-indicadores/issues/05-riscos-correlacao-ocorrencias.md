# 05 — Riscos: correlação N:N com Ocorrências

**What to build:** um usuário vincula livremente qualquer risco a qualquer
ocorrência já cadastrados (e desfaz o vínculo quando quiser), a qualquer
momento — não só no instante da criação. Isso é um mecanismo **separado** do
vínculo de origem 1:N imutável (`ocorrencia_origem_id`, entregue na 01): a
origem responde "de onde este risco nasceu", a correlação N:N responde
"quais ocorrências se relacionam com este risco hoje". O botão "Gerar risco
a partir desta ocorrência" (01) passa a também gravar a correlação N:N
correspondente, além de setar a origem — o risco nasce já vinculado numa
única ação. Dentro do registro de uma ocorrência aparece uma seção "Riscos
vinculados" (lista mesclada: vínculos N:N + o risco de origem, se houver,
com etiqueta "Origem"); dentro do detalhe de um risco aparece a seção
simétrica com as ocorrências correlacionadas. Uma nova sub-aba "Correlação"
mostra uma grade de cards (um por risco com pelo menos um vínculo), com
busca por texto e um modal por card listando as ocorrências vinculadas.

Referência de implementação completa: projeto de origem
`Flowlab_Controle_Qualidade`, branch `main`, commit `d78e375` — migration
`qualidade_riscos_ocorrencias_correlacao.sql` (tabela `qa_riscos_ocorrencias`,
FKs `ON DELETE CASCADE` para `qa_riscos`/`qa_ocorrencias`, `UNIQUE
(risco_id, ocorrencia_id)`), `components/riscos/CardCorrelacaoRisco.tsx`,
`components/riscos/ModalOcorrenciasDoRisco.tsx`,
`components/CorrelacaoRiscosOcorrenciasPage.tsx`,
`components/ocorrencias/RiscosVinculadosOcorrencia.tsx`.

**Blocked by:** 01, 02.

**Status:** done

- [x] Remover um vínculo N:N nunca afeta `ocorrencia_origem_id` (e
      vice-versa) — os dois mecanismos são independentes.
- [x] A seção "Riscos vinculados" (Ocorrências) e a seção de correlação
      (detalhe do risco) mostram a mesma informação mesclada, sem duplicar
      o vínculo de origem.
- [x] Sub-aba "Correlação" lista só riscos com pelo menos um vínculo, com
      busca funcionando por texto de risco ou de ocorrência.
- [x] `npx tsc --noEmit` e `npm test` sem erros novos.

## Comments

Implementado em `correlacaoRiscosOcorrencias.ts` (tabela `qa_riscos_ocorrencias`,
migration `20260831210000_qualidade_riscos_ocorrencias_correlacao.sql`),
`domain/riscosCorrelacao.ts` (`mesclarVinculosComOrigem`, com teste próprio),
`RiscosVinculadosOcorrencia.tsx`, `OcorrenciasCorrelacionadasRisco.tsx`,
`CorrelacaoRiscosOcorrenciasPage.tsx` + `ModalOcorrenciasDoRisco.tsx`. Em
2026-09-01, `RiscosVinculadosOcorrencia.tsx` e
`OcorrenciasCorrelacionadasRisco.tsx` (quase idênticos) foram extraídos para
`components/ui/SecaoCorrelacao.tsx` compartilhado, e a formatação de data
duplicada virou `formatarDataCurta` em `components/riscos/rotulos.ts`. `npx
tsc --noEmit` sem erros novos no módulo qualidade e `npx vitest run
src/modules/qualidade` com 87 testes passando.
