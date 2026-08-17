# Remover o alerta por email de "SC sem estoque"

Status: done

Blocked by: 08

## Onde

- `api/notifications/purchase-out-of-stock.ts` (deletar)
- `src/components/RequestManagement.tsx`, bloco de trigger (linhas
  ~509-526, o `fetch('/api/notifications/purchase-out-of-stock', ...)`)
- `src/utils/purchaseOutOfStock.ts` e `src/utils/purchaseOutOfStock.test.ts`
  (`getOutOfStockItems`) — remover só se não sobrar nenhum outro uso depois
  de tirar o trigger
- Template `purchase_request_out_of_stock` (criado em
  `supabase/migrations/20260814120000_purchase_request_out_of_stock_template.sql`)

## O que fazer

Este é o trabalho recém-commitado (`8d43b29`, `7141ed3`, `bceda90`,
`5fcee7f`) que está sendo substituído pela notificação de alçada
(`08-alcada-notificacao-email`). **Só remover depois que o 08 estiver no
ar** — para não ficar um período sem nenhuma notificação quando uma SC leva
a uma compra que precisa de aprovação.

Passos:
1. Remover o bloco de `fetch` em `RequestManagement.tsx` que dispara o
   alerta na criação de uma SC.
2. Deletar `api/notifications/purchase-out-of-stock.ts`.
3. Checar se `getOutOfStockItems`/`src/utils/purchaseOutOfStock.ts` ficam
   sem nenhum uso — se sim, deletar arquivo e teste junto; se algum outro
   lugar do código ainda usa (ex. para decidir UI de "produto não
   cadastrado"), manter só a função, sem o trigger de email.
4. Nova migration que desativa (`is_active = false`) ou remove o template
   `purchase_request_out_of_stock` — não editar a migration antiga que o
   criou.
5. Variável de ambiente `PURCHASE_ALERT_TO` pode ser removida da
   configuração do projeto (fora do repo — avisar o usuário, não é algo
   que a migration/código controla).

## Critérios de aceite

- Criar uma SC com item sem estoque não dispara mais nenhum email.
- Nenhuma chamada morta para `/api/notifications/purchase-out-of-stock`
  sobra no código.
- `08-alcada-notificacao-email` já está funcionando antes desta remoção
  entrar em produção.
