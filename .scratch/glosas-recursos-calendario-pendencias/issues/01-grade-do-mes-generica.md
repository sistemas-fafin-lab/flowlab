# 01: Preparação: grade do mês genérica

Spec: `.scratch/glosas-recursos-calendario-pendencias/spec.md`

**What to build:** a grade do mês do Calendário de envios vira um componente genérico que recebe os itens de cada dia e como desenhá-los. O Calendário de envios passa a usá-lo sem nenhuma mudança visível. É a base da grade do Calendário de recursos.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A grade (semanas de segunda a sexta, cabeçalho, navegação de mês, dia de hoje destacado) não conhece mais agendamentos, atividades nem feriados; o que é de envio entra pelo chamador.
- [x] O Calendário de envios mostra exatamente o mesmo de antes (chips, atividades, feriados, ações de clique), conferido na tela nos temas claro e escuro.
- [x] Os testes do Calendário de envios continuam passando.

## Comments

Entregue no commit `9803bf0` (`GradeMes.tsx`, `utils/mesCalendario`), usado depois pela grade do Calendário de recursos (issue 04). Os testes do Calendário de envios passam na suíte completa de 26/11/2026. A conferência visual do Calendário de envios nos dois temas não ficou registrada aqui.
