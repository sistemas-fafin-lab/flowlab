# 05 — Card dedicado de cotações pendentes na Home

**What to build:** um novo widget/card na Home, separado do card genérico de
aprovações de solicitações (`requests`) que já existe, mostrando quantas
cotações estão "aguardando aprovação" para o usuário logado (respeitando sua
alçada) e linkando para a lista de cotações já filtrada por esse status
(ticket 01) — sem deep-link por id individual.

**Blocked by:** 01

**Status:** done

- [x] Novo card na Home, distinto do widget genérico de aprovações de
      solicitações, específico de cotações
- [x] O card mostra a contagem de cotações "aguardando aprovação" que o
      usuário logado tem alçada para aprovar (mesmo critério de valor já
      usado hoje pelo sistema de alçadas)
- [x] Clicar no card leva direto para a lista de cotações filtrada por
      "aguardando aprovação" (URL do ticket 01)
- [x] Usuário sem alçada de aprovação não vê o card (mesma regra de
      permissão/alçada já usada em outros pontos do módulo de cotações)
- [x] O widget genérico de aprovações de `requests` permanece como está, sem
      alteração

## Comments

Novo widget `quotation-approvals` em `src/components/Home.tsx`, separado do
`PendingApprovalsWidget` (que fica intocado). A contagem vem do novo hook
`useQuotationsAwaitingApprovalCount` (`src/modules/quotations/hooks/`), que
busca o limite de alçada do usuário em `user_approval_limits_with_details`
(com fallback por role, mesmo critério de `fetchUserApprovalLimit` em
`useQuotation.ts`) e conta as cotações `awaiting_approval` dentro desse
limite via `countQuotationsAwaitingMyApproval` (testado). O card só entra em
`availableWidgets` quando o usuário tem `canManageQuotations` **e** alçada
(`canApprove`) — sem alçada, o widget não aparece. O link usa
`buildQuotationsUrl('', 'awaiting_approval')` (contrato do ticket 01) →
`/quotations?status=awaiting_approval`.
