# 03: Calendário de recursos: Hoje, Amanhã e Atrasados

Spec: `.scratch/glosas-recursos-calendario-pendencias/spec.md`

**What to build:** a aba "Calendário de recursos" em Glosas e Recursos, com os painéis Hoje, Amanhã e Atrasados e a lista "Sem prazo cadastrado". Cada item é um lote de faturamento de um convênio com requisições em status 6, com motivo de glosa e fora de lote de recurso enviado, agrupado pela data do prazo para recorrer. Prazo no sábado ou no domingo aparece na sexta anterior com o selo "vence sáb" ou "vence dom".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Função pura de itens do calendário: agrupamento lote × prazo, data de exibição (fim de semana → sexta anterior), selos Hoje / Amanhã / Atrasado / Futuro e lista sem prazo. Testes do spec, incluindo prazo no sábado, no domingo e virada de mês.
- [ ] Endpoint do calendário por mês e fonte pagadora, a partir da foto e das regras de prazo; uma regra alterada reflete na próxima leitura.
- [ ] Cada item mostra convênio, nº do lote, protocolo, quantidade de requisições, valor não recorrido, principais motivos e o selo de fim de semana quando houver.
- [ ] Clicar no item abre as requisições dele, com o detalhe que já existe em "Recursos fora de lote".
- [ ] A lista "Sem prazo cadastrado" tem link para a tela de regras.
- [ ] O filtro de convênio do cabeçalho vale; temas claro e escuro; sem rolagem horizontal em 390 px.
