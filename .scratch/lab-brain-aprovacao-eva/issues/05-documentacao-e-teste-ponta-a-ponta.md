# 05: Documentação e teste ponta a ponta

**What to build:** o TI e o dev do LAB-BRAIN sabem que cada pedido agora passa pela aprovação da EVA, e o fluxo inteiro está conferido no ambiente local e depois em produção. Ver `../spec.md`: Further Notes.

**Blocked by:** 01, 02, 03, 04

**Status:** ready-for-agent

- [x] O guia da integração de chamados do LAB-BRAIN descreve:
  - a sugestão de promoção e o que a aprovação e a rejeição fazem;
  - o `resolucao` no cancelado.
- [ ] O documento entregue ao dev do LAB-BRAIN ganha as duas notas: o TI avalia cada pedido antes de ele entrar no Kanban, e `resolucao` também aparece no cancelado.
- [ ] Os chamados de teste IT-132 e IT-133 são cancelados no banco de teste antes do roteiro.
- [ ] Roteiro local (API em `localhost:3000`, front em `localhost:5173`, banco de teste), conferido passo a passo:
  1. criar o chamado;
  2. a sugestão aparece na fila, com o aviso no sino;
  3. aprovar promove, e a consulta mostra a coluna;
  4. criar outro chamado e rejeitar a sugestão, e a consulta mostra `cancelled` com o motivo;
  5. criar um terceiro e promover pela tela de sempre, e a sugestão fica substituída.
- [ ] Migrations aplicadas em produção, com o ok do usuário, depois do teste.
- [ ] Teste rápido em produção com um chamado de teste, cancelado no fim.

## Comments

- 13/11/2026: `docs/integracoes/LAB_BRAIN_CHAMADOS.md` ganhou a seção "Aprovação pela EVA" (sugestão, regra fixa, aviso no sino, aprovar, rejeitar, substituir), o `resolucao` no `cancelled` na tabela da consulta e os passos de implantação das migrations `20261113150000` a `20261113180000`.
- 13/11/2026: o documento entregue ao dev do LAB-BRAIN não está no repositório. As duas notas, prontas para colar nele:

  > **Avaliação do TI.** Cada pedido agora passa pela avaliação do TI antes de entrar no Kanban. A criação continua igual: `201 { id, codigo }` na hora, sem esperar a avaliação. Enquanto o TI não decide, a consulta mostra `situacao: "pending"` e `coluna_kanban: null`. Se o TI aprovar, a consulta passa a mostrar a coluna, a prioridade e o responsável. Se recusar, o chamado é cancelado.
  >
  > **`resolucao` no cancelado.** O campo `resolucao` agora vem preenchido também quando `situacao` é `cancelled`, além de `resolved`. No cancelado, ele traz o motivo da recusa, escrito pelo TI para o solicitante. Repasse esse texto à pessoa que fez o pedido.

- 13/11/2026: no banco de teste, a `20261113170000_eva_promover_card_substituida` estava aplicada (trigger e RPC com o GUC `ti_agente.aprovando` presentes), mas sem registro em `supabase_migrations.schema_migrations`.
