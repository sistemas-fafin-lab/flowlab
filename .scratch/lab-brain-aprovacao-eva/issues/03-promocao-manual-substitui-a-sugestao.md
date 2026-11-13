# 03: Promover pela tela de sempre tira a sugestão da fila

**What to build:** se alguém do TI coloca no Kanban um chamado do LAB-BRAIN por fora da fila da EVA, a sugestão de promoção pendente sai da fila como substituída. Isso vale para a promoção manual em Solicitações de TI e para qualquer caminho futuro. Ver `../spec.md`: Banco (Substituição) e as histórias 21 e 22.

**Blocked by:** 01

**Status:** done

- [x] Um trigger nos chamados marca como `substituida` a sugestão `promover_card` pendente quando o chamado sai de "fora do Kanban" por qualquer caminho que não seja a RPC de aprovação.
- [x] A aprovação pela RPC não marca a própria sugestão como substituída: ela continua `aprovada`.
- [x] Sugestões já decididas (aprovadas, rejeitadas) não mudam.
- [x] Na fila de Sugestões, a substituída aparece com o status que a tela já mostra para esse caso.
- [x] Script SQL de verificação, no banco de teste com `ROLLBACK`:
  - promover por fora marca como substituída;
  - aprovar pela RPC não marca;
  - sugestão já decidida não muda.
- [x] Migration aplicada no banco de teste (`eqz`).

## Notas da implementação

- Migration `20261113170000_eva_promover_card_substituida.sql`: trigger `trg_it_requests_substituir_promover_card` (`AFTER UPDATE OF kanban_hidden`, só na passagem de `true` para `false`), com a função `ti_agente_substituir_promover_card` em `SECURITY DEFINER`, porque quem promove pela tela não tem UPDATE em `ti_agente_sugestoes` pela RLS.
- Exclusão da aprovação: `ti_agente_aprovar_sugestao_como` grava o id da própria sugestão no GUC local `ti_agente.aprovando` em volta do UPDATE do chamado, e o trigger pula só essa sugestão. O GUC é limpo depois do `IF NOT FOUND`, porque um `PERFORM` logo depois do UPDATE mudaria o `FOUND`. Outra promoção por fora na mesma transação continua substituindo.
- A substituída fica com `decidido_por`/`decidido_em` vazios, como na reanálise de reunião. Na fila, ela sai de "Pendentes" e aparece em "Todas" com o selo "Substituída", que a tela já tinha. Não precisou mudar a tela.
- Só `promover_card` muda. Outras sugestões do mesmo chamado continuam como estão.
- Com isso, o caso "promovido por fora e depois rejeitado" da issue 02 agora é recusado como "já decidida". O script da 02 foi ajustado para isso, e a barreira "já está no Kanban" da RPC de rejeição continua testada com uma sugestão criada depois da promoção. A 02 já pode ir para produção junto com esta.
- Aplicada no `eqz` e registrada no histórico. Verificação em `supabase/scripts/verificar_eva_promover_card_substituida.sql`. Os scripts das issues 01 e 02 continuam passando.

## Comments

**13/11/2026, na entrega da issue 01:** em `ti_agente_aprovar_sugestao_como` (`20261113150000_eva_promover_card_lab_brain.sql`), o ramo `promover_card` atualiza o chamado (`kanban_hidden = false`) **antes** de marcar a sugestão como `aprovada`. O trigger desta issue vai ver uma `promover_card` ainda `pendente` nesse UPDATE. O resultado final sairia certo por acaso, porque o UPDATE seguinte sobrescreve com `aprovada`. Faça a exclusão de forma explícita, por exemplo com um GUC local da transação ligado pela RPC (`set_config('ti_agente.aprovando', 'on', true)`) ou marcando a sugestão antes do chamado. A RPC também já recusa promover um chamado cancelado ou que já está no Kanban.
