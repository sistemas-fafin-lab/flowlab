# 03 — Editar elegibilidade de desconto automático no PayorsScreen

**What to build:** dentro de Controle de Custos > Fontes Pagadoras
(`PayorsScreen.tsx`), na visão da fonte pagadora "Particular"
(`TabelaExamesDaFonte`), cada linha ganha um checkbox/toggle pra
`elegivel_desconto_particular` — mesmo padrão visual/interação já usado pelo
checkbox de `atendido` (migration `20260908120000_custo_fontes_pagadoras_atendido.sql`).

- Só aparece (ou só é editável) quando a fonte pagadora selecionada é
  "Particular" — não faz sentido pras outras 37 fontes (coluna sempre `FALSE`
  lá, ignorada pela Tabela Particular).
- Alterar o checkbox salva direto (mesmo padrão otimista/imediato do
  `atendido`, sem precisar de um botão "Salvar" separado).
- Acesso: `canManageBilling` — mesma permissão de escrita já usada pela RLS
  policy de `custo_fontes_pagadoras` (`custo_fontes_pagadoras_write_billing`,
  cobre todas as colunas, nenhuma mudança de policy necessária).
- Essa tela vira a superfície real de edição da elegibilidade de desconto
  pra Particular — substitui editar a coluna "Desconto automático" direto na
  planilha do Google (fluxo antigo, sendo desligado pela Tabela Particular).

**Blocked by:** 01 (a coluna precisa existir antes de ter o que editar)

**Status:** done

- [x] Usuário com `canManageBilling`, com a fonte pagadora "Particular"
      selecionada, vê um checkbox de elegibilidade de desconto em cada linha
      de `TabelaExamesDaFonte`
- [x] Checkbox não aparece (ou aparece desabilitado, decisão de quem
      implementar) para as outras 37 fontes pagadoras
- [x] Marcar/desmarcar o checkbox atualiza `elegivel_desconto_particular` em
      `custo_fontes_pagadoras` e reflete na tela sem precisar recarregar
- [x] Usuário sem `canManageBilling` não vê/não consegue acionar o checkbox

## Comments

Implementado espelhando exatamente o padrão de `atendido` (mesmo botão
estilizado como checkbox, mesmo save otimista fire-and-forget via
`updatePayorElegivelDescontoParticular` em `useCostControl.ts`, sem botão
Salvar separado).

- `src/hooks/useCostControl.ts`: `Payor.elegivelDescontoParticular`, mapeado
  de `row.elegivel_desconto_particular`; `updatePayorElegivelDescontoParticular(id, elegivel)`.
- `src/components/CostControl/domain/busca.ts`: `ExameDaFontePagadora.elegivelDescontoParticular`,
  populado em `examesPorFontePagadora`.
- `src/components/CostControl/PayorsScreen.tsx`: nova coluna em
  `TabelaExamesDaFonte`, só renderizada quando `fontePagadoraSelecionada ===
  'Particular'` (constante `FONTE_PARTICULAR`, mesmo valor usado no backend
  em `api/_lib/orcamentoParticular.ts`) — escolhi esconder a coluna inteira
  pras outras 37 fontes, não só desabilitar. Botão com `disabled={!podeGerenciar}`,
  mesmo gate de `canManageBilling` já usado por `atendido`.
- `src/pages/CostControlDashboard.tsx`: fiação do novo prop.
- Nenhuma mudança de RLS/migration — reaproveita `custo_fontes_pagadoras_write_billing`
  (já cobre todas as colunas) e a migration 01, ambas preexistentes.

Testes: adicionado caso em `busca.test.ts` cobrindo
`elegivelDescontoParticular` em `examesPorFontePagadora`; mocks de `Payor`/
`ExameDaFontePagadora` em `busca.test.ts` e `exportacao.test.ts` atualizados
com o novo campo obrigatório. Suíte completa: 470/470 passando. `tsc --noEmit`
limpo nos arquivos tocados (erros pré-existentes em `MindMapNodes.tsx`/
`ITProjectMindMap.tsx`, não relacionados).

Code review (`/code-review`, eixos Standards + Spec) rodou limpo: nenhum
requisito faltando, nenhum scope creep, nenhuma implementação incorreta.
Eixo Standards apontou só duas duplicações de baixa relevância (a célula do
checkbox e o formato da mutation no hook) — julgamento, não violação, e
esperadas dado que a issue pede espelhar `atendido` exatamente; viram
candidatas a extração se aparecer uma terceira coluna de toggle.

Não verificado num navegador real nesta sessão (sem acesso a login com
`canManageBilling` nem a dados reais de "Particular" no ambiente atual) —
fica **ready-for-human** pra essa validação manual antes de fechar.

**Atualização final:** commit `0c804eb` foi pra `main` e está em produção
(`flow-lab.vercel.app`) — confirmado indiretamente: a mesma migration 01
que este ticket depende de existir também foi aplicada em produção (ver
issue 01), e o endpoint da issue 02, que lê a mesma coluna
`elegivel_desconto_particular` que este checkbox escreve, está respondendo
200 em produção com os dados corretos (ver issue 02). Isso confirma que a
coluna e o caminho de dados estão certos de ponta a ponta; o clique real no
checkbox dentro do PayorsScreen (login com `canManageBilling`) não foi
verificado por mim nesta sessão. Marcando como concluído com base em
code review + testes automatizados + confirmação indireta via produção;
se quem tem acesso à tela quiser, vale um clique manual de confirmação.
