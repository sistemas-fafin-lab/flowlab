# 03 — Cadastrar fonte pagadora nova do zero

**What to build:** dentro de Controle de Custos > Fontes Pagadoras
(`PayorsScreen.tsx`), um botão "Nova Fonte Pagadora" no cabeçalho da tela
(ao lado de "Importar"/"Exportar") que abre o modal do ticket 01/02 em
modo criação, sem nenhuma fonte pagadora selecionada como contexto.

- Reaproveita o mesmo modal e o mesmo método de criação do ticket 02 — só
  muda o ponto de entrada e o pré-preenchimento.
- Todos os campos começam em branco, incluindo **Fonte Pagadora** — o
  usuário pode digitar um nome que nunca apareceu em nenhum import (não
  precisa vir de uma lista existente).
- Ao salvar, a tela passa a mostrar essa fonte pagadora como selecionada
  (equivalente a already ter buscado e selecionado ela no campo de busca),
  exibindo a `TabelaExamesDaFonte` com a linha recém-criada.
- Mesma regra de acesso dos tickets anteriores (`canManageBilling`) — o
  botão só aparece pra quem tem essa permissão, mesmo padrão do botão
  "Importar" já existente.

**Blocked by:** 02 — Adicionar uma linha de preço a uma fonte pagadora já
selecionada (reaproveita o fluxo de criação de linha; só muda o ponto de
entrada e remove o pré-preenchimento de Fonte Pagadora).

**Status:** done

- [x] Usuário com `canManageBilling` vê o botão "Nova Fonte Pagadora" no
      cabeçalho, ao lado de Importar/Exportar
- [x] Usuário sem `canManageBilling` não vê/não consegue acionar o botão
- [x] Clicar no botão abre o modal em modo criação com todos os campos em
      branco (incluindo Fonte Pagadora)
- [x] É possível digitar um nome de Fonte Pagadora que ainda não existe em
      nenhuma linha de `custo_fontes_pagadoras`
- [x] Salvar sem Fonte Pagadora preenchida é bloqueado (campo obrigatório)
- [x] Salvar cria a linha e a tela passa a exibir essa fonte pagadora como
      selecionada, com a linha recém-criada visível em
      `TabelaExamesDaFonte` (assumindo que um TUSS válido — já cadastrado
      na aba Exames — também é preenchido; mesma ressalva herdada do
      ticket 02 sobre `examesPorFontePagadora` casar linhas por TUSS)
