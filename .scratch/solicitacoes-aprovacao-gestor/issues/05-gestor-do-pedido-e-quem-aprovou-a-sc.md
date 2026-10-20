# 05 — Cotação: gestor do pedido travado é quem aprovou a SC

**What to build:** revisão da issue 09 de `cotacoes-aprovacao-gestor`. Na
cotação de Compras, a origem travada passa a ser
`requests.approved_by_user_id` (quem aprovou a SC), não mais
`requested_by_user_id`. SC aprovada por admin no lugar (sem aprovador) não
trava: vale a escolha manual da issue 09. Contratação (manutenção) não muda.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] Trigger `quotation_enforce_requester_manager` usa `approved_by_user_id` (e não trava quando a aprovação foi do admin no lugar).
- [x] `resolveRequesterManagerChoice` / `useRequesterManagerOptions` idem, com testes atualizados.
- [ ] Validado no projeto de teste (depende da 06, 01 e 02 aplicadas lá).

## Comments

**20/10/2026 — trava em quem aprovou a SC.**

- Migration `supabase/migrations/20261020235200_quotation_gestor_quem_aprovou_sc.sql`
  (depois da 02; aborta se `requests.decided_without_approver` não existir):
  `CREATE OR REPLACE` de `quotation_enforce_requester_manager`. Em Compras a
  origem é `approved_by_user_id`, nula quando `decided_without_approver`
  (admin no lugar). Contratação e as demais regras (nunca o comprador nem
  quem grava, origem inativa não trava) não mudam. A mensagem de erro passa
  a dizer "quem aprovou a Solicitação de Compras".
- Client: `RequesterManagerSource` troca `requestRequestedByUserId` por
  `requestApprovedByUserId` + `requestDecidedWithoutApprover`;
  `useRequesterManagerOptions` lê as duas colunas; o texto do
  `SubmitForApprovalModal` diz quem é o gestor travado. 11 testes.
- Efeito: SC aprovada antes da 02 (sem `approved_by_user_id`) não trava
  mais. Cotações já com gestor gravado não mudam (o trigger só age quando
  `requester_manager_id` muda); no reenvio/troca, o comprador escolhe.
- Validado num Postgres 18 local descartável com esquema mínimo: SC
  aprovada pelo aprovador trava nele (barra quem pediu e outro); admin no
  lugar e SC legada não travam; Contratação trava em quem abriu; comprador
  barrado; aprovador inativo não trava.
- Falta: validar no projeto de teste depois que 06, 01 e 02 estiverem lá.
