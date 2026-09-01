# 03 — Botão "Aprovar" + modal-resumo (propostas + vencedora em destaque)

**What to build:** na lista de cotações, cada item em "aguardando aprovação"
visível para quem tem alçada ganha uma ação/botão "Aprovar" que abre
diretamente um modal-resumo — sem passar pelo painel de detalhes lateral
genérico nem navegar por abas internas. O modal mostra as informações
essenciais da cotação (código, título, solicitante, valor, itens) e **todas**
as propostas recebidas, com a proposta vencedora atual destacada visualmente
entre as demais. Do mesmo modal, o gestor aprova ou rejeita a cotação,
reaproveitando a decisão atômica já existente no domínio (que já verifica
autorização e valor no servidor).

**Blocked by:** None — can start immediately

**Status:** done

- [x] Cotação em "aguardando aprovação" mostra um botão "Aprovar" na lista,
      visível apenas para usuários com alçada para aquela cotação
- [x] Clicar no botão abre o modal-resumo diretamente, sem passar pelo painel
      de detalhes lateral existente
- [x] O modal mostra as informações essenciais da cotação (código, título,
      solicitante, valor total, itens)
- [x] O modal sempre lista **todas** as propostas recebidas para aquela
      cotação, não só a vencedora
- [x] A proposta vencedora atual é destacada visualmente entre as demais,
      reaproveitando a lógica de anotação (menor preço/vencedora) já usada
      hoje na comparação de propostas — sem duplicá-la
- [x] O gestor consegue aprovar ou rejeitar a cotação a partir do modal,
      usando a mesma decisão atômica (com verificação de autorização/valor)
      já existente no domínio
- [x] Teste unitário cobre a função que monta a lista de propostas anotada
      (todas presentes, vencedora corretamente marcada)

## Comments

Implementado em `1228219`. A lógica de anotação de propostas (menor preço,
vencedora) foi extraída de `ProposalComparison` para
`src/modules/quotations/utils/annotateProposals.ts`, reaproveitada por
ambos — testada em `annotateProposals.test.ts`. O botão "Aprovar" foi
adicionado à lista inline em `QuotationManagementPage.tsx` (o componente
`QuotationList.tsx` não é usado em nenhum lugar do app — a lista real vive
na própria página). O novo `QuotationApprovalModal` reaproveita
`ApprovalTimeline` para a decisão de aprovar/rejeitar, mantendo a RPC
atômica existente. A troca de vencedora dentro do modal fica para a issue
04.
