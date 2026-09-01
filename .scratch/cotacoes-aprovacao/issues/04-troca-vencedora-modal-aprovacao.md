# 04 — Troca de vencedora dentro do modal de aprovação

**What to build:** dentro do modal-resumo de aprovação (ticket 03), o gestor
passa a poder trocar qual proposta é a vencedora antes de aprovar ou
rejeitar, sem sair do fluxo. A troca reaproveita a operação de seleção de
vencedora já existente no domínio de cotações. Se a vencedora for trocada, a
verificação de valor/alçada usada na decisão de aprovação passa a refletir a
proposta recém-selecionada. Cada troca gera uma entrada própria no histórico
de auditoria da cotação, distinta da entrada de aprovação/rejeição.

**Blocked by:** 03

**Status:** done

- [x] Dentro do modal-resumo, o gestor consegue selecionar uma proposta
      diferente da vencedora atual antes de decidir
- [x] A troca reaproveita a operação de seleção de vencedora já existente no
      domínio (não duplica a lógica)
- [x] Ao aprovar depois de trocar a vencedora, a verificação de
      valor/alçada usa o valor da proposta recém-selecionada, não da
      vencedora anterior
- [x] A troca de vencedora gera uma entrada própria no histórico de
      auditoria da cotação, separada da entrada de aprovação/rejeição
- [x] Rejeitar a cotação sem trocar a vencedora continua funcionando como
      hoje (comportamento do ticket 03 preservado)
- [x] Teste unitário cobre o caso de troca de vencedora na função de
      montagem/anotação de propostas do ticket 03

## Comments

O botão "Selecionar" (mesmo rótulo já usado em `ProposalComparison`) foi
adicionado a cada proposta não-vencedora dentro de `QuotationApprovalModal`,
chamando o `selectWinner` já existente em `useQuotation` — nenhuma lógica de
seleção foi duplicada. `canSelectWinner` em `stateMachine.ts` passou a
incluir `'awaiting_approval'` para permitir a troca a partir do modal de
aprovação (o gate independente do `QuotationDrawer` não foi afetado). Como
`selectWinner` já atualiza `finalTotalAmount` e já grava um log de auditoria
`proposal_selected` distinto de `approved`/`rejected`, a checagem de alçada e
o histórico funcionam "de graça" — o `useEffect` que já ressincronizava
`approvalQuotation` após qualquer ação (herdado do ticket 03) garante que o
modal reflita o novo valor antes da decisão. Os botões Aprovar/Rejeitar
ficam desabilitados enquanto uma troca está em andamento, para não decidir
com base num valor que ainda não foi atualizado pelo refresh. O teste de
troca de vencedora em `annotateProposals.test.ts` já existia desde o ticket
03 e cobre o requisito.
