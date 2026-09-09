# 01 — Exportar Fontes Pagadoras (xlsx/csv)

**What to build:** dentro de Controle de Custos > Fontes Pagadoras
(`PayorsScreen.tsx`), um botão "Exportar" que gera um arquivo com os
custos por fonte pagadora, no mesmo espírito do dropdown "Exportar" já
existente na aba Exames (`ExamsScreen.tsx`, usando a lib `xlsx` já
instalada no projeto).

- Formatos suportados: `.xlsx` e `.csv`.
- O botão sempre respeita os filtros de busca ativos na tela (`termoFonte`
  / `termoExame`, e a fonte/exame selecionados) — exporta exatamente o
  recorte que está sendo exibido (`examesDaFonteFiltrados` /
  `fontesDoExame`).
- Quando nenhum filtro está ativo (estado em que a tela hoje não mostra
  nenhuma tabela), o botão busca e exporta **todas** as linhas de
  `custo_fontes_pagadoras` diretamente do Supabase — não depende de nada
  estar renderizado na tela.
- Acesso: mesma permissão que já protege a leitura do módulo,
  `canViewBilling` — nenhuma permissão nova.

**Blocked by:** Nenhum — pode começar imediatamente.

**Status:** done

- [x] Botão "Exportar" visível na aba Fontes Pagadoras, para usuários com
      `canViewBilling`
- [x] Exporta em `.xlsx` e em `.csv`
- [x] Com um filtro de busca ativo (fonte ou exame), o arquivo exportado
      contém exatamente as linhas exibidas na tela naquele momento
- [x] Sem nenhum filtro ativo, o arquivo exportado contém todas as linhas
      de `custo_fontes_pagadoras`, mesmo a tela não estando mostrando
      nenhuma tabela nesse estado
- [x] Usuário sem `canViewBilling` não vê/não consegue acionar o botão

## Comments

Implementado em PayorsScreen.tsx: dropdown "Exportar" (.xlsx/.csv) no
mesmo padrão do já existente em ExamsScreen.tsx. Com fonte e/ou exame
selecionados, exporta exatamente `examesDaFonteFiltrados`/`fontesDoExame`
(o mesmo recorte renderizado na tela). Sem filtro ativo, chama
`buscarTodasFontesPagadoras` (nova função exportada de
`useCostControl.ts`, extraída da lógica paginada que já existia em
`fetchPayors`) — busca todas as linhas de `custo_fontes_pagadoras` direto
do Supabase, sem depender do state `payors` já carregado. Acesso
continua gated só pela `ProtectedRoute permission="canViewBilling"` que já
protegia a rota `/cost-control` inteira — nenhuma permissão nova.
Mapeamento de linhas extraído para `domain/exportacao.ts` (testado em
`exportacao.test.ts`), seguindo o padrão de `domain/busca.ts`.
