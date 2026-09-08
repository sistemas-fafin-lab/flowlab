# 06 — Fontes Pagadoras: navegação cruzada entre exame e fonte pagadora

**What to build:** dentro da tabela de resultado, clicar no nome da
entidade oposta pivota a busca pra ela, sem precisar apagar e redigitar.

Contexto: resultado de sessão de grilling com o usuário em 2026-09-08.

- Na tabela de um exame selecionado (`Fonte Pagadora | Tabela Associada |
  Valor Cobrado`), o nome da fonte pagadora em cada linha é clicável.
  Clicar nele pivota a busca: a fonte pagadora clicada passa a ser a
  seleção atual, e a tela passa a mostrar a tabela `Exame | TUSS | Tabela
  Associada | Valor Cobrado` daquela fonte pagadora (mesmo comportamento
  de seleção do ticket 04, só que disparado por clique na tabela em vez
  de escolha no dropdown de busca).
- Na tabela de uma fonte pagadora selecionada (`Exame | TUSS | Tabela
  Associada | Valor Cobrado`), o nome do exame em cada linha é clicável.
  Clicar nele pivota a busca pro exame, mostrando a tabela `Fonte
  Pagadora | Tabela Associada | Valor Cobrado` daquele exame.
- Só o nome da entidade (fonte pagadora numa tabela, exame na outra) é
  clicável — as demais colunas (TUSS, Tabela Associada, Valor Cobrado)
  não disparam navegação.
- A seleção anterior é simplesmente substituída pela nova — sem
  histórico, sem breadcrumb, sem botão "voltar". O chip do campo de busca
  atualiza pra refletir a nova seleção (tipo + nome), igual a uma seleção
  feita pelo dropdown.
- O campo de busca some/limpa o termo digitado anterior ao pivotar, indo
  direto pro estado de "selecionado", igual a uma seleção normal.

**Blocked by:** 04 — precisa das duas tabelas de resultado e da lógica de
seleção/chip já existindo.

**Status:** done

- [x] Nome da fonte pagadora, na tabela de um exame, é clicável e pivota a
      busca pra aquela fonte pagadora
- [x] Nome do exame, na tabela de uma fonte pagadora, é clicável e pivota
      a busca pra aquele exame
- [x] Colunas que não são o nome da entidade (TUSS, Tabela Associada,
      Valor Cobrado) não disparam navegação ao clicar
- [x] Após pivotar, o chip do campo de busca reflete a nova seleção (tipo
      + nome), igual a uma seleção feita via dropdown
- [x] Após pivotar, a tabela de resultado exibida corresponde à nova
      seleção (tipo certo de colunas)
- [x] Nenhum histórico de navegação/breadcrumb/botão voltar foi
      adicionado — pivotar substitui a seleção atual diretamente
- [x] Ordenação da tabela (ticket 05, se já implementado) volta ao padrão
      após pivotar, mesma regra de troca de seleção

## Comments
