# 05: Documentação e teste ponta a ponta

**What to build:** o TI e o dev do LAB-BRAIN sabem que cada pedido agora passa pela aprovação da EVA, e o fluxo inteiro está conferido no ambiente local e depois em produção. Ver `../spec.md`: Further Notes.

**Blocked by:** 01, 02, 03, 04

**Status:** ready-for-agent

- [ ] O guia da integração de chamados do LAB-BRAIN descreve:
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
