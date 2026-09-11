# 04 — TUSS compartilhado por exames com nomes diferentes escondia um deles

**What to build:** achado durante teste manual (usuário reportou "Fósforo - U
não aparece" no app da Tabela Particular) — `custo_exames` tem vários
códigos TUSS reaproveitados por exames com nomes diferentes (65 casos, de um
total de 503 exames, no ambiente de teste — ex.: `FÓSFORO - S` e
`FÓSFORO - U` sob o mesmo TUSS `40301931`). Como o join entre
`custo_fontes_pagadoras` e `custo_exames` é feito só pelo TUSS (sem examId
confiável vindo do APLIS), tanto o `PayorsScreen` (`examesPorFontePagadora`)
quanto o endpoint `/api/integracoes/orcamento-particular`
(`buildOrcamentoParticular`) escolhiam arbitrariamente só UM dos nomes por
TUSS, escondendo os demais sem nenhum aviso.

- `examesPorFontePagadora` (`src/components/CostControl/domain/busca.ts`)
  e `buildOrcamentoParticular` (`api/_lib/orcamentoParticular.ts`) passam a
  devolver uma linha/item por nome distinto de exame que compartilha um
  TUSS, em vez de um só — mesmo preço/atendido/elegibilidade nos dois
  (é o mesmo registro de `custo_fontes_pagadoras`).
- `ExameDaFontePagadora` ganhou `exameId`, e os botões de
  selecionar/editar exame no `PayorsScreen` passaram a resolver pelo id do
  exame (não mais pelo TUSS) — necessário porque agora um TUSS pode
  corresponder a mais de um `Exam`.
- `examesDaFonteFiltrados` corrigido pra filtrar por `exameId` (bug
  encontrado no code-review: ainda filtrava por `tuss`, então selecionar um
  exame específico entre "irmãos" de TUSS não narrowava de verdade).
- Ações destrutivas/de alternância (excluir, atendido, elegibilidade) agora
  avisam quando o `payorId` da linha é compartilhado com outra(s) linha(s)
  de nome diferente: ícone com tooltip na tabela, e o texto do diálogo de
  confirmação de exclusão lista os nomes afetados (achado de "most severe"
  no code-review: excluir uma linha excluía a(s) outra(s) silenciosamente,
  já que é o mesmo registro no banco).
- `/api/integracoes/orcamento-particular`: `tuss` deixa de ser
  garantidamente único no array de resposta — documentado no JSDoc de
  `OrcamentoParticularItem`. Verificado que o consumidor (app Tabela
  Particular) já lida bem com isso (mapeia o array item a item, sem indexar
  por `tuss`).
- Duplicata literal (mesmo TUSS **e** mesmo nome) continua virando uma
  linha só, com a entrada mais recente vencendo — mesma semântica de
  "último vence" de antes desta mudança (o code-review flagou uma
  inversão acidental pra "primeiro vence" na primeira versão do fix,
  corrigida antes de commitar).

**Blocked by:** Nenhuma

**Status:** done

- [x] TUSS compartilhado por exames com nomes diferentes: todos os nomes
      aparecem (PayorsScreen e endpoint), não só um
- [x] Duplicata literal (mesmo TUSS e nome): continua virando uma linha só
- [x] Excluir/alternar atendido/elegibilidade numa linha com `payorId`
      compartilhado avisa visivelmente sobre as linhas afetadas
- [x] `examesDaFonteFiltrados` narrowa por exame específico corretamente
      (por `exameId`, não por `tuss`)
- [x] `/api/integracoes/orcamento-particular`: contrato de `tuss` não-único
      documentado
- [x] `npm run lint`, `npx tsc --noEmit` e a suíte de testes passam

## Comments

Confirmado ponta a ponta com o app rodando localmente: `PayorsScreen`
(localhost:5173), `/api/integracoes/orcamento-particular` via `vercel dev`
(localhost:3000, curl direto), e o consumidor real — app da Tabela
Particular (localhost:3001/alvaro-orcamento) — todos mostrando `FÓSFORO - S`
e `FÓSFORO - U` como itens separados.

Code review (`/code-review`) rodou duas vezes: a primeira apontou 2 bugs
reais (delete/toggle silenciosos por `payorId` compartilhado;
`examesDaFonteFiltrados` ainda filtrando por `tuss`) e uma inversão
acidental de semântica (primeiro-vence em vez de último-vence pra
duplicata literal) — todos corrigidos antes do commit. Achados de
reuso/eficiência (duplicação de ~9 linhas entre `busca.ts` e
`orcamentoParticular.ts` cruzando `src/`/`api/`; scan O(k) em vez de O(1)
pro dedup por nome) deliberadamente não endereçados — desproporcionais ao
tamanho real dos dados (≤503 exames) e à duplicação (dois deploy targets
sem infra de módulo compartilhado hoje).
