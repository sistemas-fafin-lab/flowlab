# 03: Promover pela tela de sempre tira a sugestão da fila

**What to build:** se alguém do TI coloca no Kanban um chamado do LAB-BRAIN por fora da fila da EVA, a sugestão de promoção pendente sai da fila como substituída. Isso vale para a promoção manual em Solicitações de TI e para qualquer caminho futuro. Ver `../spec.md`: Banco (Substituição) e as histórias 21 e 22.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Um trigger nos chamados marca como `substituida` a sugestão `promover_card` pendente quando o chamado sai de "fora do Kanban" por qualquer caminho que não seja a RPC de aprovação.
- [ ] A aprovação pela RPC não marca a própria sugestão como substituída: ela continua `aprovada`.
- [ ] Sugestões já decididas (aprovadas, rejeitadas) não mudam.
- [ ] Na fila de Sugestões, a substituída aparece com o status que a tela já mostra para esse caso.
- [ ] Script SQL de verificação, no banco de teste com `ROLLBACK`:
  - promover por fora marca como substituída;
  - aprovar pela RPC não marca;
  - sugestão já decidida não muda.
- [ ] Migration aplicada no banco de teste (`eqz`).

## Comments

**13/11/2026, na entrega da issue 01:** em `ti_agente_aprovar_sugestao_como` (`20261113150000_eva_promover_card_lab_brain.sql`), o ramo `promover_card` atualiza o chamado (`kanban_hidden = false`) **antes** de marcar a sugestão como `aprovada`. O trigger desta issue vai ver uma `promover_card` ainda `pendente` nesse UPDATE. O resultado final sairia certo por acaso, porque o UPDATE seguinte sobrescreve com `aprovada`. Faça a exclusão de forma explícita, por exemplo com um GUC local da transação ligado pela RPC (`set_config('ti_agente.aprovando', 'on', true)`) ou marcando a sugestão antes do chamado. A RPC também já recusa promover um chamado cancelado ou que já está no Kanban.
