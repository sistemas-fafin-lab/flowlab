# 02 — Adicionar uma linha de preço a uma fonte pagadora já selecionada

**What to build:** dentro de Controle de Custos > Fontes Pagadoras
(`PayorsScreen.tsx`), com uma fonte pagadora já selecionada, um botão
"Novo" na tabela `TabelaExamesDaFonte` que abre o mesmo modal do ticket 01
em modo criação.

- Reaproveita o modal e os métodos de escrita (`createPayor` ou
  equivalente no hook `useCostControl.ts`) construídos no ticket 01 — não
  cria um segundo componente de formulário.
- Campo **Fonte Pagadora** vem pré-preenchido com o nome da fonte
  pagadora atualmente selecionada, mas continua editável (pode ser trocado
  se o usuário quiser, mas o caso comum é manter).
- Demais campos (Tabela Associada, TUSS, Valor Cobrado) começam em
  branco.
- Ao salvar, a nova linha é gravada em `custo_fontes_pagadoras` e passa a
  aparecer na tabela sem recarregar a página.
- Mesma regra de acesso do ticket 01 (`canManageBilling`).

**Blocked by:** 01 — Editar e excluir uma linha de Fonte Pagadora
(reaproveita o modal e os métodos de escrita criados ali).

**Status:** done

- [x] Usuário com `canManageBilling`, com uma fonte pagadora selecionada,
      vê o botão "Novo" em `TabelaExamesDaFonte`
- [x] Usuário sem `canManageBilling` não vê/não consegue acionar o botão
- [x] Clicar em "Novo" abre o modal em modo criação com Fonte Pagadora
      pré-preenchida (editável) e os demais campos em branco
- [x] Salvar sem Fonte Pagadora preenchida é bloqueado (campo obrigatório)
- [x] Salvar cria uma nova linha em `custo_fontes_pagadoras` e ela aparece
      na tabela imediatamente

## Comments

Implementado reaproveitando `PayorFormModal.tsx`/`updatePayor` do ticket
01: `createPayor` novo em `useCostControl.ts` (payload dedupicado com
`updatePayor` via helper `toPayorRow`) + botão "Novo" na toolbar de
`TabelaExamesDaFonte` + `mode: 'edit' | 'create'` no modal pra distinguir
título/ícone.

Achado durante a implementação: `TabelaExamesDaFonte` casa cada linha de
`custo_fontes_pagadoras` com um exame pelo TUSS
(`examesPorFontePagadora` em `domain/busca.ts`) — se o TUSS digitado no
"Novo" ainda não existir na aba Exames, a linha é gravada mas some da
tabela (o join não encontra par). Como o campo TUSS começa em branco por
spec, esse é o caminho comum. Corrigido com um aviso explícito
(`showWarning`) no lugar do toast de sucesso simples nesse caso, avisando
que a linha foi salva mas só vai aparecer quando existir um exame com
aquele TUSS — sem bloquear o salvamento, já que cadastrar o preço antes do
exame existir no catálogo é um fluxo válido.
