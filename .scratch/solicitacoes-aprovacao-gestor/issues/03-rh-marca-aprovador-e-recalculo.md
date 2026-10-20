# 03 — Recálculo das SCs sem aprovador quando o RH muda o departamento

**What to build:** quando `colaboradores.departamento_id` ou
`departamentos.aprovador_sc_id` mudarem, recalcular `approver_id` só das
SCs `pending` com `approver_id` nulo; SCs que já têm aprovador não mudam.
O recálculo tem de ser `SECURITY DEFINER` (a proteção da issue 01 barra
`authenticated`). O e-mail ao novo aprovador fica na issue 04. A marca
"aprova SC" na ficha deixou de existir: o aprovador é definido na aba
Departamentos (issue 06).

**Blocked by:** 01, 06

**Status:** ready-for-agent

- [ ] Trigger(s) de recálculo em `colaboradores` (`departamento_id`) e `departamentos` (`aprovador_sc_id`), restritos a SCs pendentes sem aprovador, `SECURITY DEFINER`.
- [ ] Validado: colocar a Ana Claudia num departamento com aprovador leva a SC pendente dela (REQ868) a esse aprovador; definir o aprovador de um departamento sem aprovador leva as SCs pendentes dos membros a ele.
