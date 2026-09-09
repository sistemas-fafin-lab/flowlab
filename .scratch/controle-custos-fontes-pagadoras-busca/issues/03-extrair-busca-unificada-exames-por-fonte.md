# 03 — Extrair funções puras de busca unificada e exames por fonte pagadora

**What to build:** funções puras e testadas, adicionadas ao módulo
`domain/busca.ts` (mesmo arquivo do ticket 01), seguindo o mesmo padrão já
usado no repo: lógica de negócio extraída, testada via Vitest
(`describe`/`it`, `environment: 'node'`) sem renderizar nenhum componente
React.

Contexto: resultado de sessão de grilling com o usuário em 2026-09-08. A
aba "Fontes Pagadoras" hoje (pós ticket 02) só busca por exame/TUSS. O
usuário quer também buscar por fonte pagadora e, ao selecioná-la, ver a
lista de exames que ela cobre — busca unificada nos dois sentidos.

- Uma função de busca unificada recebe o termo digitado, a lista de exames
  e a lista de fontes pagadoras, e devolve os exames E as fontes pagadoras
  que combinam com o termo, separados/tipados (não uma lista misturada)
  — nome do exame ou código TUSS (parcial, case-insensitive) para exames;
  nome da fonte pagadora (parcial, case-insensitive) para fontes
  pagadoras.
- Fontes pagadoras no resultado da busca aparecem **uma única vez por nome
  distinto**, mesmo que existam várias linhas da mesma fonte pagadora
  (uma por tabela associada/TUSS diferente).
- Uma função separada recebe o nome de uma fonte pagadora, a lista de
  fontes pagadoras e a lista de exames, e devolve os exames daquela fonte
  pagadora — join pelo TUSS (`Payor.tus` ↔ `Exam.tuss`), com os campos
  necessários para a tabela do ticket 04 (exame, TUSS, tabela associada,
  valor cobrado). Ordenada por valor cobrado crescente, mesmo critério já
  usado em `fontesPagadorasPorTuss`.
- Termo vazio ou sem nenhum resultado não quebra nada — devolve listas
  vazias.
- Este ticket não altera nenhum comportamento visível na tela — é só a
  base testável pro ticket 04 construir em cima.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Função de busca unificada existe, exportada, e devolve exames e
      fontes pagadoras combinando com o termo, tipados/separados
- [x] Fontes pagadoras no resultado aparecem deduplicadas por nome
      distinto
- [x] Função de exames por fonte pagadora existe, exportada, faz o join
      pelo TUSS, e devolve o resultado ordenado por valor crescente
- [x] Termo vazio devolve listas vazias (não a lista inteira)
- [x] Termo sem nenhum match devolve listas vazias
- [x] Testes cobrem: termo vazio, termo sem match, match só de exame, match
      só de fonte pagadora, match simultâneo dos dois tipos, deduplicação
      de fonte pagadora com múltiplas linhas, e a ordenação por preço
      crescente na listagem de exames por fonte pagadora
- [x] Nenhum teste depende de renderizar componente React nem de mock de
      Supabase — são funções puras sobre arrays já carregados em memória

## Comments
