# Renomear "Prazo de Entrega" (campo geral da cotação) para "Prazo de Entrega / Fornecimento"

Status: done

## Onde

- `src/modules/quotations/components/CreateQuotationModal.tsx:412`
- `src/modules/quotations/components/PurchaseOrderModal.tsx:272`
- `src/modules/quotations/utils/generateQuotationPDF.ts:137`

## O que fazer

Trocar o label visível "Prazo de Entrega" por "Prazo de Entrega /
Fornecimento" nos três pontos acima — todos referem-se ao campo geral da
cotação (`deliveryDeadline`/`delivery_deadline`), não ao campo por-item.

**Não alterar** o campo "Prazo de Entrega (dias)" dentro de
`AddProposalModal.tsx` (linha ~428) — esse é por-item de uma proposta de
fornecedor e continua com o nome atual, pois sempre se refere a entrega de
produto/mercadoria, mesmo numa cotação de serviço.

Não é necessária nenhuma mudança de schema, tipo ou nome de variável — é
puramente o texto exibido ao usuário.

## Critérios de aceite

- Os três pontos listados mostram "Prazo de Entrega / Fornecimento".
- O campo por-item da proposta continua "Prazo de Entrega (dias)".
