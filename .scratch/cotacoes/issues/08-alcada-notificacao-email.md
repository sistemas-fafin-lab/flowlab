# Notificar gestores por email quando cotação entra em "Aguardando Aprovação"

Status: ready-for-agent

## Onde

- `src/modules/quotations/hooks/useQuotation.ts` (ponto onde o status muda
  para `awaiting_approval`, hoje disparado por `onSubmitForApproval` em
  `QuotationDrawer.tsx`, linhas ~674-681)
- `supabase/migrations/20260220120000_user_approval_limits.sql` (view
  `user_approval_limits_with_details`, já expõe `effective_max_amount` e
  `can_approve`)
- `api/notifications/email.ts` (endpoint genérico já existente,
  `sendTemplatedEmail`)
- Nova migration para o template de email (seguir o padrão de
  `supabase/migrations/20260814120000_purchase_request_out_of_stock_template.sql`
  e da tabela `email_notification_templates`)

## O que fazer

Quando uma cotação (Compras ou Contratação, tanto faz) entra em status
`awaiting_approval`, disparar um email para todos os usuários com alçada
suficiente para aquele valor.

1. **Template novo**: criar um registro em `email_notification_templates`
   (ex. slug `quotation_awaiting_approval`), com variáveis tipo
   `quotation_code`, `quotation_title`, `quotation_type_label`,
   `requester_name`, `total_amount`, `action_url` (link direto pra
   cotação).
2. **Query dos destinatários**: consultar
   `user_approval_limits_with_details` filtrando `can_approve = true` e
   `effective_max_amount >= valor da cotação` (usar
   `estimatedTotalAmount`/`finalTotalAmount`, o que estiver disponível no
   momento da submissão).
3. **Disparo**: no ponto em que `useQuotation.ts` muda o status para
   `awaiting_approval`, chamar `POST /api/notifications/email` (endpoint
   genérico, não precisa endpoint dedicado — diferente do alerta de
   estoque removido em `09-remover-alerta-estoque`, aqui o destinatário é
   dinâmico e já é dado visível dentro do app) uma vez por destinatário
   elegível.
4. Envio deve ser "melhor esforço" — falha no envio não pode bloquear a
   submissão da cotação para aprovação (mesmo padrão de try/catch já usado
   no alerta antigo).

## Critérios de aceite

- Submeter uma cotação para aprovação dispara email para todo gestor com
  `can_approve = true` e alçada >= valor da cotação.
- Gestor sem alçada suficiente para aquele valor não recebe o email.
- Falha no envio de email não impede a cotação de mudar de status.
- Funciona igual para `quotation_type = 'compras'` e `'contratacao'`.
