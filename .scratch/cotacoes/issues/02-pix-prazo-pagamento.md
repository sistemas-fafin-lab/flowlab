# Prazo de pagamento também para PIX na proposta

Status: ready-for-agent

## Onde

`src/modules/quotations/components/AddProposalModal.tsx`, bloco "Payment
Method" (linhas ~486-530), estado `boletoDueDays` (linha ~58).

## O que fazer

O campo "Prazo do Boleto (dias)" só aparece quando
`paymentMethod === 'boleto'`. Ele deve aparecer também quando
`paymentMethod === 'pix'`, com a mesma mecânica (número de dias após a
emissão até o vencimento).

Não renomear o campo internamente (`boletoDueDays` no estado, no tipo
`SubmitProposalInput`/`SupplierProposal` e na coluna do banco) — só ajustar
a condição de exibição e o label visível para algo genérico, ex. "Prazo
para Pagamento (dias)", já que o campo passa a valer para as duas formas de
pagamento. Cartão de crédito continua sem esse campo.

## Critérios de aceite

- Selecionar "Pix" como forma de pagamento mostra o campo de prazo em dias,
  igual ao que já acontece com boleto.
- Selecionar "Cartão de Crédito" não mostra o campo (comportamento atual
  mantido).
- Nenhuma migração de banco necessária — `boletoDueDays`/`boleto_due_days`
  continuam armazenando o valor independente da forma de pagamento
  escolhida.
