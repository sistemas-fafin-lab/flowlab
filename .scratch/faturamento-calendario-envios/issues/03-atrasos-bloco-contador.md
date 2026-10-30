# 03: Atrasos: classificação, bloco Atrasados e contador no menu

**What to build:** cada Agendamento de envio aparece com a cor do seu status: pendente, enviado, 🟡 atrasado (passou a data agendada) ou 🔴 fora do prazo do convênio (passou o fim da janela da Regra de envio). Agendamentos fora da janela da regra levam um selo cinza "fora da janela" só informativo. Ao lado de Hoje/Amanhã fica o bloco **Atrasados**, onde a faturista marca como enviado (com a data real) ou reagenda. O item do menu mostra um contador vermelho com o total de atrasados. Regras de status na spec.

**Blocked by:** 02 (Calendário com Hoje/Amanhã e marcação de envio).

**Status:** done

- [x] Classificação no módulo de domínio (agendamento, regra, hoje → status + selo), com testes: pendente antes da data, atrasado depois, fora do prazo depois do fim da janela, "todos os dias" e "calendário do convênio" nunca fora do prazo, enviado vence atrasado, selo "fora da janela".
- [x] O GET do mês devolve os agendamentos já classificados; telas não recalculam status.
- [x] Cores por status na grade e nos painéis, com legenda.
- [x] Bloco "Atrasados" lista atrasados e fora do prazo (fora do prazo primeiro), de qualquer mês, até serem resolvidos; ações marcar enviado e reagendar para outra data.
- [x] GET leve do contador (sem ler o backup) e contador vermelho no item "Calendário de envios" do menu, oculto quando zero.
