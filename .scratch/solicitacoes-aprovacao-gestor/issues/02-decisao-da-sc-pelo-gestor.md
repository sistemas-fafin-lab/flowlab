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

- [ ] RPC com autorização, status, comentário obrigatório na rejeição.
- [ ] RLS de `requests` permite ao aprovador ler as SCs dele.
- [ ] Regra pura de visibilidade dos botões com testes (aprovador, admin com/sem aprovador, comprador, SM).
- [ ] Lista: filtro, aprovador exibido na SC pendente, Compras bloqueado em `pending`.
- [ ] Validado com usuários de teste (aprovador, admin, terceiro sem acesso).
