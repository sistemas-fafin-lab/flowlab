# 01 — Extrair funções puras de busca de exame e fontes pagadoras

**What to build:** duas funções puras e testadas, extraídas da lógica de
filtro hoje embutida em `PayorsScreen.tsx` (aba "Fontes Pagadoras" de
Controle de Custos), seguindo o mesmo padrão já usado no repo (ex.:
`faturamento/utils/filtrosUrl.ts`, `analises-clinicas/domain/status.ts`):
lógica de negócio extraída em módulo próprio, testada via Vitest
(`describe`/`it`, `environment: 'node'`) sem renderizar nenhum componente
React.

- Uma função recebe a lista de exames e um termo de busca, e devolve os
  exames cujo nome OU código TUSS contém aquele termo — correspondência
  parcial, case-insensitive, tanto pro nome quanto pro TUSS.
- Outra função recebe a lista de fontes pagadoras e o código TUSS de um
  exame, e devolve só as fontes pagadoras daquele TUSS, ordenadas por valor
  cobrado crescente (mais barato primeiro).
- Termo de busca vazio ou sem nenhum resultado não quebra nada — devolve
  lista vazia.
- Este ticket não altera nenhum comportamento visível na tela — é só a base
  testável pro ticket 02 construir em cima.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Função de busca de exames por termo existe, exportada, e casa por nome
      OU código TUSS, com correspondência parcial e case-insensitive
- [x] Função de listagem de fontes pagadoras por TUSS existe, exportada, e
      devolve o resultado ordenado por valor crescente
- [x] Termo vazio devolve lista vazia (não a lista inteira)
- [x] Termo sem nenhum match devolve lista vazia
- [x] Testes cobrem: termo vazio, termo sem match, match só por nome, match
      só por TUSS (parcial, não precisa ser o código completo), múltiplos
      matches simultâneos, e a ordenação por preço crescente
- [x] Nenhum teste depende de renderizar componente React nem de mock de
      Supabase — são funções puras sobre arrays já carregados em memória

## Comments
