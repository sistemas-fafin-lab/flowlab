# 06: Pendências de glosa

Spec: `.scratch/glosas-recursos-calendario-pendencias/spec.md`

**What to build:** no Dashboard de glosa, o bloco "Pendências de glosa" com seletor de mês e "Todo o período" e três cards (valor e quantidade): glosas sem recurso com prazo vencido, recursos com retorno atrasado e recursos com pagamento atrasado. Cada card abre a lista filtrada.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Função pura das pendências por recorte e hoje, usando os prazos por requisição (issue 02) e o prazo para recorrer, com os testes do spec.
- [ ] O card de prazo vencido abre "Recursos fora de lote" com o filtro novo "vencidos"; os de retorno e de pagamento atrasado abrem "Lotes de recurso" com os filtros novos correspondentes.
- [ ] Recurso sem data de envio não entra nos cards de atraso.
- [ ] Visual das Pendências de faturamento do Contas a Receber, nos temas claro e escuro.
