# 01: Preparação: grade do mês genérica

Spec: `.scratch/glosas-recursos-calendario-pendencias/spec.md`

**What to build:** a grade do mês do Calendário de envios vira um componente genérico que recebe os itens de cada dia e como desenhá-los. O Calendário de envios passa a usá-lo sem nenhuma mudança visível. É a base da grade do Calendário de recursos.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A grade (semanas de segunda a sexta, cabeçalho, navegação de mês, dia de hoje destacado) não conhece mais agendamentos, atividades nem feriados; o que é de envio entra pelo chamador.
- [ ] O Calendário de envios mostra exatamente o mesmo de antes (chips, atividades, feriados, ações de clique), conferido na tela nos temas claro e escuro.
- [ ] Os testes do Calendário de envios continuam passando.
