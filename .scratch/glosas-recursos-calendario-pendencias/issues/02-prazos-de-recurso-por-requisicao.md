# 02: Preparação: prazos de recurso por requisição

Spec: `.scratch/glosas-recursos-calendario-pendencias/spec.md`

**What to build:** uma função pura no módulo de regras de recurso de glosa que dá, para cada requisição de um lote de recurso, a data de retorno prevista, a data de pagamento prevista e se o recurso já tem resultado final (deferido total, indeferido ou acatado). A lista de Lotes de recurso passa a usá-la sem mudar o que mostra. É a base das Pendências de glosa e do Aging.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Para cada requisição, a função devolve: datas previstas (com a data real de retorno, quando existe, como base do pagamento), se tem resultado final, valor em aberto (recursado − recebido de glosa) e motivo de não ter data (lote não enviado, convênio sem regra de Análise ou de Pagamento).
- [x] Testes: lote não enviado; retorno real substitui o previsto; regra sem prazo; cada classe de resultado final; edições do lápis valem acima do apLIS.
- [x] A lista de Lotes de recurso mostra as mesmas datas e selos de antes.

## Comments

- Implementada como `prazosDasRequisicoes` em `api/_lib/faturamento/recursoGlosa.ts`. A `prazosDoLote` (lista de Lotes de recurso) tira dela a regra do selo e divide o mesmo cálculo de datas; o handler não mudou.
- Para o ticket do Aging (07): com data real de retorno e regra de Análise "sem prazo", a função dá data de pagamento (o retorno real é a base). O spec do Aging diz que "convênio sem regra de Análise" vai para "Fora das faixas". Confirmar qual vale. **Decidido (26/11/2026): fica fora das faixas.** Registrado no spec e na issue 07; esta função não muda.
