# 01 — Aprovador da SC pelo departamento de quem pediu

**What to build:** `requests.approver_id` gravado na criação da SC com o
`aprovador_sc_id` do departamento de quem pediu, se utilizável (ativo, com
login, usuário ativo, e não o próprio solicitante); senão nulo, sem
procurar outro. Inclui o cálculo único no deploy para as SCs `pending` sem
aprovador e a proteção contra o client alterar aprovador/quem aprovou. Só
SC; SM fica sem aprovador. Ver spec, "Resolução do aprovador" e "Schema
das SCs".

**Blocked by:** 06

**Status:** ready-for-agent

- [x] Migration: `requests.approver_id`, `requests.approved_by_user_id`.
- [x] Trigger na criação de SC (ignora o valor do client) e trigger que barra UPDATE de aprovador/quem aprovou vindo de `authenticated`/`anon`.
- [x] **Retrabalho:** editar `20261020170000_sc_aprovador_pela_cadeia_do_rh.sql` no lugar (nunca aplicada): tirar `aprova_solicitacao_compra`, a marcação inicial por nome e a cadeia por `gestor_id`; `requests_resolver_aprovador` passa a ler `departamentos.aprovador_sc_id`. Pode renomear o arquivo (não foi aplicado em lugar nenhum).
- [x] Função pura espelho reescrita com testes (departamento com/sem aprovador, aprovador desligado/sem login/desativado → nulo, aprovador = solicitante, sem colaborador, sem departamento, aprovador de outro departamento).
- [x] Backfill das SCs `pending` sem aprovador no deploy.
- [ ] Validado no projeto de teste. (depende da 06 aplicada no teste)

## Comments

**20/10/2026 — primeira versão (cadeia por `gestor_id`), commit `a997a85`.**
Nunca aplicada em nenhum projeto.

- Migration `supabase/migrations/20261020170000_sc_aprovador_pela_cadeia_do_rh.sql`:
  colunas, `requests_resolver_aprovador(uuid)`, trigger de criação
  (`requests_definir_aprovador`, ignora o `approver_id` do client), marcação
  dos três aprovadores pelo nome e backfill das SCs `pending` sem aprovador.
- Achado de review: a policy de UPDATE de `requests` é aberta, então o client
  poderia se fazer `approver_id`. `requests_proteger_aprovador` barra mudança
  de `approver_id`/`approved_by_user_id` vinda de `authenticated`/`anon`;
  funções SECURITY DEFINER, service_role e migrations passam. **A RPC da
  issue 02 e o recálculo da issue 03 precisam ser SECURITY DEFINER.**
- Espelho puro `src/utils/requestApprover.ts` + testes.
- Validado num Postgres local descartável com esquema mínimo.

**20/10/2026 — revisão do desenho (grilling).** A cadeia de `gestor_id` com
a marca na ficha foi trocada por departamentos (issue 06). Ficam como estão:
`approver_id`, `approved_by_user_id`, trigger de criação e proteção contra o
client. Muda a resolução e sai a marcação inicial (os aprovadores agora são
carregados na issue 06).

**20/10/2026 — retrabalho pelo departamento.**

- Migration renomeada para
  `supabase/migrations/20261020220000_sc_aprovador_pelo_departamento.sql`
  (nunca aplicada). Saíram `aprova_solicitacao_compra`, a marcação por nome e
  a cadeia por `gestor_id`; `requests_resolver_aprovador` agora é SQL puro:
  `departamentos.aprovador_sc_id` do colaborador de quem pediu, se ativo, com
  login, usuário ativo e não o próprio solicitante; senão NULL. Ficaram as
  colunas, o trigger de criação, a proteção contra o client e o backfill.
- **A migration da issue 06 precisa ter timestamp menor que 20261020220000.**
  Se não tiver, esta aborta logo no começo com "Aplique antes a migration dos
  departamentos".
- Espelho `resolveRequestApprover(requesterUserId, colaboradores, departamentos)`
  em `src/utils/requestApprover.ts`, 10 testes. Ainda sem uso na tela (issue 02).
- Validado num Postgres 18 local descartável, com esquema mínimo e a 06
  simulada: guarda sem a 06; backfill (só SC pending; SM, aprovada e sem
  solicitante ficam NULL); criação nos casos da spec (outro departamento,
  própria SC, desligado/sem login/desativado/removido, sem departamento,
  departamento sem aprovador, sem colaborador, SM, valor mandado pelo client
  ignorado); proteção (`authenticated` não altera approver/approved_by, mas
  edita outros campos; o superusuário grava); reaplicar não reatribui.
- Falta: validar no projeto de teste depois que a 06 estiver aplicada lá.
