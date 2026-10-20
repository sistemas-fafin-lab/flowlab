# 03 — RH: marca de aprovador na ficha e recálculo das SCs sem aprovador

**What to build:** campo "Aprova solicitações de compra" na ficha do
colaborador (mesma permissão de edição do RH). Quando `gestor_id` ou a
marca mudarem, recalcular `approver_id` só das SCs `pending` com
`approver_id` nulo; SCs que já têm aprovador não mudam. O e-mail ao novo
aprovador fica na issue 04.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Campo na ficha do RH.
- [ ] Trigger de recálculo restrito a SCs pendentes sem aprovador.
- [ ] Validado: ajustar Ana Claudia/Eduarda → Paulo leva a SC pendente da Ana Claudia ao Paulo.
