# 02 — Fontes Pagadoras: nova UX de busca por TUSS/exame

**What to build:** a aba "Fontes Pagadoras" (dentro de Controle de Custos)
deixa de mostrar a listagem completa de convênios e passa a funcionar só
por pesquisa: o usuário digita o código TUSS ou o nome do exame, escolhe o
exame certo (quando há mais de um resultado) e vê a lista de fontes
pagadoras e preços só daquele exame — sem precisar navegar por uma tabela
grande nem por filtros de convênio/tabela associada.

Resultado de sessão de grilling com o usuário em 2026-09-04. Contexto:
hoje essa aba é dado 100% mockado em memória (sem tabela no Supabase, sem
CRUD, sem sincronização real com APLIS apesar do rótulo visual) — esta
mudança é só de UI/UX sobre esse mesmo dado, sem impacto na aba "Análise de
Rentabilidade" nem no cadastro de exames.

- Remove a listagem completa de fontes pagadoras e os dois filtros dropdown
  (convênio, tabela associada) que existem hoje.
- Remove do cabeçalho os botões "Atualizar do APLIS" e "Exportar (Excel)" e
  o badge "Sincronizado com APLIS" — nenhum tinha função real.
- Um único campo de busca por TUSS ou nome do exame, filtrando em tempo
  real a cada tecla digitada (usa as funções do ticket 01).
- Busca por TUSS aceita correspondência parcial, não precisa ser o código
  completo.
- Antes de digitar qualquer coisa, mostra uma mensagem convidando o usuário
  a pesquisar.
- Enquanto digita: se houver mais de um exame combinando com o termo,
  aparece um dropdown de sugestões — uma linha por exame, mostrando nome e
  código TUSS.
- Se houver exatamente um exame combinando, pula direto pra lista de fontes
  pagadoras/preços daquele exame, sem precisar clicar em nada.
- Se não houver nenhum exame combinando, mostra mensagem "nenhum exame
  encontrado".
- Ao clicar num exame do dropdown, o campo de busca passa a mostrar o
  exame selecionado (estilo chip/tag), com uma opção de limpar ("x") pra
  voltar ao estado de busca.
- A lista de fontes pagadoras do exame selecionado mostra: Fonte Pagadora,
  Tabela Associada e Valor Cobrado — ordenada por valor crescente (mais
  barato primeiro).

**Blocked by:** 01 — depende das funções puras de busca/listagem por preço.

**Status:** done

- [x] A listagem completa de fontes pagadoras e os filtros dropdown de
      convênio/tabela associada não aparecem mais na tela
- [x] O cabeçalho não mostra mais "Atualizar do APLIS", "Exportar (Excel)"
      nem o badge "Sincronizado com APLIS"
- [x] Existe um único campo de busca por TUSS ou nome do exame, filtrando
      em tempo real
- [x] Antes de digitar, aparece uma mensagem convidando a pesquisar
- [x] Busca por TUSS aceita correspondência parcial
- [x] Múltiplos exames encontrados → aparece dropdown com nome + TUSS por
      linha
- [x] Exatamente um exame encontrado → pula direto pra lista de fontes
      pagadoras/preços, sem exigir clique
- [x] Nenhum exame encontrado → mensagem "nenhum exame encontrado"
- [x] Selecionar um exame no dropdown troca o campo de busca por um chip do
      exame escolhido, com "x" pra limpar e voltar a pesquisar
- [x] Lista de fontes pagadoras do exame selecionado mostra Fonte Pagadora,
      Tabela Associada e Valor Cobrado, ordenada por valor crescente
- [x] A aba "Análise de Rentabilidade" e os dados subjacentes (fontes
      pagadoras mockadas, catálogo de exames) continuam funcionando sem
      nenhuma mudança de comportamento

## Comments
