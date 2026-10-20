# 01 — Aprovador da SC pela cadeia do RH

**What to build:** marca "Aprova solicitações de compra" no colaborador e
`requests.approver_id` gravado na criação da SC, subindo `gestor_id` até o
primeiro aprovador utilizável (ativo, com login, usuário ativo). Inclui o
cálculo único no deploy para as SCs `pending` e a marcação inicial de
Paulo Vítor, Louise Fontel e Suane Batista De Oliveira. Só SC; SM fica
sem aprovador. Ver spec, "Resolução do aprovador" e "Dados iniciais".

**Blocked by:** —

**Status:** ready-for-agent

- [x] Migration: `colaboradores.aprova_solicitacao_compra`, `requests.approver_id`, `requests.approved_by_user_id`.
- [x] Função no banco de resolução + trigger na criação de SC.
- [x] Função pura espelho com testes (cadeia simples, pula não aprovador Marina → Eduarda → Paulo, pula desligado/sem login/desativado, topo sem gestor, solicitante sem colaborador).
- [x] Backfill das SCs `pending` no deploy; marcação inicial dos três aprovadores.
- [ ] Validado no projeto de teste.

## Comments

**20/10/2026 — implementado, falta validar no projeto de teste.**

- Migration `supabase/migrations/20261020170000_sc_aprovador_pela_cadeia_do_rh.sql`:
  colunas, `requests_resolver_aprovador(uuid)`, trigger de criação
  (`requests_definir_aprovador`, ignora o `approver_id` do client), marcação
  dos três aprovadores pelo nome (nome ausente só dá WARNING — conferir no
  deploy) e backfill das SCs `pending` sem aprovador.
- Achado de review: a policy de UPDATE de `requests` é aberta, então o client
  poderia se fazer `approver_id`. `requests_proteger_aprovador` barra mudança
  de `approver_id`/`approved_by_user_id` vinda de `authenticated`/`anon`;
  funções SECURITY DEFINER, service_role e migrations passam. **A RPC da
  issue 02 e o recálculo da issue 03 precisam ser SECURITY DEFINER.**
- Espelho puro `src/utils/requestApprover.ts` + testes.
- Validado num Postgres local descartável com esquema mínimo: cadeia, pulos
  (desligado, desativado, não aprovador), SM, topo, client forjando
  aprovador no INSERT e no UPDATE, DEFINER passando, reaplicação sem
  reatribuir.
