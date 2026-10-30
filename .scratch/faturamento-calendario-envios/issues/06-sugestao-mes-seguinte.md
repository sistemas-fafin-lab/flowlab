# 06: Sugestão do mês seguinte

**What to build:** a partir do dia 15, o Calendário mostra o botão **"Gerar sugestão de <mês seguinte>"**, e um aviso "<mês> ainda não foi planejado" enquanto ele não for gerado. A sugestão cria os Agendamentos de envio a partir das Regras de envio, equilibrando a carga dos dias como a equipe faz hoje. Gerar de novo só refaz os agendamentos sugeridos que ainda estão pendentes e não foram editados. Depois de editar uma regra, o sistema oferece regerar o mês. Novembro/2026 já vem gerado. Algoritmo na spec (Regras da sugestão).

**Blocked by:** 04 (Edição de agendamentos), 05 (Cadastro de Regras de envio e feriados).

**Status:** done

- [x] Geração no módulo de domínio (mês, regras ativas, feriados, agendamentos existentes → criar + remover), com testes: cada tipo de janela, feriado no meio de faixa de dias úteis, dia fixo no sábado vai para o próximo dia útil, último dia útil antes de feriado, desempate pelo dia mais cedo, faixas estreitas antes das largas, N envios de "todos os dias" em N trechos, "todos os dias" sem N e "calendário do convênio" não geram nada, regerar preserva manuais/editados e não duplica janelas.
- [x] POST de gerar sugestão: mês seguinte a partir do dia 15 do mês corrente, ou o próprio mês corrente (regeração); grava histórico "criou"/"removeu" com origem sugestão.
- [x] Botão e aviso de mês não planejado na tela; confirmação antes de regerar mostrando quantos agendamentos serão criados e removidos.
- [x] Após salvar uma regra, oferta de regerar o mês seguinte (e o corrente, se ainda houver pendentes não editados).
- [x] Carga de novembro/2026 gerada pelo módulo e gravada (migration ou script idempotente).
