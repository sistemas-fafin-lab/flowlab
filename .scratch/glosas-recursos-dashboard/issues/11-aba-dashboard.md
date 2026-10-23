# 11: Aba "Dashboard"

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** a aba Dashboard mostra o panorama do período: 4 cards (Glosas Abertas, Em Recurso, Revertidas, Definitivas), com valor, quantidade e variação em relação ao mês de faturamento anterior; evolução dos últimos 6 meses; distribuição por status; principais procedimentos glosados; ranking de convênios; e resumo por motivo de glosa.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Os cards usam a tradução de status do spec e a glosa fixada (nas Revertidas, o valor deferido).
- [ ] A evolução mostra Abertas, Em recurso e Revertidas nos 6 meses até o período filtrado.
- [ ] A distribuição por status mostra o total, o percentual e a quantidade de cada status.
- [ ] Os procedimentos alternam entre "maior valor" e "mais ocorrências", com valor e percentual do total.
- [ ] O ranking de convênios mostra valor e percentual do total.
- [ ] O resumo por motivo usa o catálogo de motivos do apLIS e agrupa os menores em "Outros".
- [ ] Os gráficos seguem a biblioteca e o padrão dos dashboards do faturamento e funcionam nos temas claro e escuro.
- [ ] Um período anterior a 2026 mostra o aviso de dados de recurso incompletos (o aviso vale para a página toda).
