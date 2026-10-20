# 05 — Cotação: gestor do pedido travado é quem aprovou a SC

**What to build:** revisão da issue 09 de `cotacoes-aprovacao-gestor`. Na
cotação de Compras, a origem travada passa a ser
`requests.approved_by_user_id` (quem aprovou a SC), não mais
`requested_by_user_id`. SC aprovada por admin no lugar (sem aprovador) não
trava: vale a escolha manual da issue 09. Contratação (manutenção) não muda.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Trigger `quotation_enforce_requester_manager` usa `approved_by_user_id` (e não trava quando a aprovação foi do admin no lugar).
- [ ] `resolveRequesterManagerChoice` / `useRequesterManagerOptions` idem, com testes atualizados.
- [ ] Validado no projeto de teste.
