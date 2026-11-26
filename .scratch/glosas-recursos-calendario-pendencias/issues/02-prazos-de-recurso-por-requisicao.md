# 02: Preparação: prazos de recurso por requisição

Spec: `.scratch/glosas-recursos-calendario-pendencias/spec.md`

**What to build:** uma função pura no módulo de regras de recurso de glosa que dá, para cada requisição de um lote de recurso, a data de retorno prevista, a data de pagamento prevista e se o recurso já tem resultado final (deferido total, indeferido ou acatado). A lista de Lotes de recurso passa a usá-la sem mudar o que mostra. É a base das Pendências de glosa e do Aging.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Para cada requisição, a função devolve: datas previstas (com a data real de retorno, quando existe, como base do pagamento), se tem resultado final, valor em aberto (recursado − recebido de glosa) e motivo de não ter data (lote não enviado, convênio sem regra de Análise ou de Pagamento).
- [ ] Testes: lote não enviado; retorno real substitui o previsto; regra sem prazo; cada classe de resultado final; edições do lápis valem acima do apLIS.
- [ ] A lista de Lotes de recurso mostra as mesmas datas e selos de antes.
