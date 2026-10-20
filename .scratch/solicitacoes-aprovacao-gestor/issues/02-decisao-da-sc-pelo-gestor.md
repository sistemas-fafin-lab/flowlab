# 02 — Decisão da SC pelo aprovador

**What to build:** RPC atômica de aprovar/rejeitar SC (autoriza o
`approver_id`, ou quem tem `canApproveRequests` quando `approver_id` é
nulo; rejeição com comentário obrigatório; grava `approved_by_user_id` e se
foi admin no lugar). Na tela de Solicitações: o aprovador vê o próprio setor
+ as SCs em que é aprovador (RLS), filtro "Aguardando minha aprovação",
Aprovar/Rejeitar visíveis só para quem pode decidir, aviso "sem aprovador
no RH", e iniciar cotação/finalizar bloqueados com SC `pending`.
SM continua como hoje. A RPC tem de ser `SECURITY DEFINER` (a proteção da
issue 01 barra `authenticated` de gravar `approved_by_user_id`).

**Blocked by:** 01

**Status:** ready-for-agent

- [x] RPC com autorização, status, comentário obrigatório na rejeição.
- [x] RLS de `requests` permite ao aprovador ler as SCs dele. (o SELECT já é aberto a autenticado; nada a mudar)
- [x] Regra pura de visibilidade dos botões com testes (aprovador, admin com/sem aprovador, comprador, SM).
- [x] Lista: filtro, aprovador exibido na SC pendente, Compras bloqueado em `pending`.
- [ ] Validado com usuários de teste (aprovador, admin, terceiro sem acesso). (depende da 06 e da 01 aplicadas no teste)

## Comments

**20/10/2026 — implementação.**

- Migration `supabase/migrations/20261020230000_sc_decisao_pelo_aprovador.sql`
  (depois da 01; aborta se `approver_id` não existir):
  - colunas `decided_without_approver` (admin no lugar), `rejected_by_user_id`,
    `rejection_comment`;
  - RPC `requests_decidir_sc(id, 'approved'|'rejected', comentário)`,
    `SECURITY DEFINER`, `FOR UPDATE`: autoriza o `approver_id`, ou
    `canApproveRequests` com `approver_id` nulo; exige SC `pending`;
    comentário obrigatório na rejeição; grava `approved_by` (texto),
    `approval_date`, `approved_by_user_id`; devolve se foi no lugar do aprovador;
  - trigger `requests_proteger_decisao_sc`: a policy de UPDATE é aberta, então
    sem ela o client aprovaria com UPDATE direto. Vindo de `authenticated`/`anon`:
    SC nasce `pending` e sem decisão; nenhuma solicitação troca de tipo (SM
    pendente virando SC aprovada); SC só muda de `approved` para `completed`;
    colunas da decisão não mudam. SM segue por UPDATE direto como antes;
  - trigger em `quotations`: não nasce cotação de SC `pending`/`rejected`.
- RLS: o SELECT de `requests` já é `USING (true)` para autenticado, então o
  aprovador já lê as SCs dele; o recorte por setor continua só na tela
  (`canSeeRequest`). Um terceiro lê qualquer SC pela API, como hoje.
- Regra pura `src/utils/requestActions.ts` (`requestActions`, `canSeeRequest`,
  `isApproverOf`) + 15 testes.
- Tela: botões pela regra; Aprovar/Rejeitar da SC chamam a RPC; rejeição de SC
  abre modal com motivo obrigatório; aviso ao decidir "no lugar"; SC pendente
  mostra o aprovador ou "Sem aprovador no RH"; "Aprovado por" indica quando foi
  no lugar; motivo da rejeição no card; filtro "Aguardando minha aprovação"
  (o que o usuário pode decidir agora — para Compras inclui SM pendente e SC
  sem aprovador), ligado por `?aprovacao=minha`
  (`buildRequestsAwaitingMyApprovalUrl` em `api/_lib/requestsRoutes.ts`, para o
  e-mail da issue 04).
- Validado num Postgres 18 local descartável com esquema mínimo (01 + 02):
  criação forçada a `pending`; UPDATE direto barrado (aprovar, trocar tipo,
  colunas da decisão, SC aprovada → rejeitada, SM → SC aprovada); RPC
  (SM, decisão inválida, rejeição sem motivo, admin com aprovador, terceiro,
  solicitante, sem login, anon, decidir de novo → erro; aprovador aprova/rejeita
  → `f`; admin sem aprovador → `t`); cotação de SC pendente/rejeitada barrada,
  de aprovada passa; SM e finalização da SC aprovada seguem; reaplicável.
- **Deploy:** o client passa a ler `approver_id`, `decided_without_approver`,
  `rejection_comment` e o nome do aprovador; publicar o front só depois das
  migrations 06, 01 e 02 aplicadas, senão a lista de Solicitações quebra.
- **Em aberto (decidir):** `/requests/purchases` exige `canViewRequests`
  (`src/App.tsx`). Aprovador cujo cargo não tem essa permissão não chega à tela,
  contra "Ser aprovador não exige permissão nenhuma de cargo". Não mexido.
- Falta: validar no projeto de teste com usuários reais (aprovador, admin,
  terceiro).

