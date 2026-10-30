# 04: Edição de agendamentos e "Pode enviar qualquer dia"

**What to build:** a faturista abre o detalhe de um Agendamento de envio e vê a observação da regra ("XML junto", "física e online"), os convênios membros (AMHPDF), quem marcou e o histórico completo. Dali ela move o agendamento para outro dia ou remove. Uma lista lateral **"Pode enviar qualquer dia"** mostra os convênios cuja regra é "todos os dias"; ela escolhe um e um dia para agendar. Agendar fora da janela nunca é bloqueado.

**Blocked by:** 02 (Calendário com Hoje/Amanhã e marcação de envio).

**Status:** done

- [x] POSTs de mover e remover agendamento, gravando o histórico (antes/depois, quem, quando).
- [x] Mover marca o agendamento como "editado"; agendamentos criados à mão têm origem "manual". (Base para a regeneração da sugestão preservar ajustes.)
- [x] Detalhe do agendamento com observação, membros, status, data de envio, quem marcou e histórico.
- [x] Tooltip na grade com observação e membros.
- [x] Lista lateral "Pode enviar qualquer dia" com as regras ativas de "todos os dias"; agendar cria um agendamento manual no dia escolhido (pode haver mais de um do mesmo convênio no mesmo mês ou dia).
- [x] Mover/criar fora da janela é permitido e mostra o selo "fora da janela" (se o 03 já estiver feito).
- [x] Arrastar e soltar é opcional; mover pelo detalhe basta.
