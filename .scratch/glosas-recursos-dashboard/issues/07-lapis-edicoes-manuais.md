# 07: Lápis: edições manuais de lote e de requisição

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** no card "Detalhes do recurso", o lápis permite corrigir, no lote, a data de envio, a data real de retorno e a data real de pagamento, e, em cada requisição, o valor recursado e o valor recebido de glosa. Os valores editados ficam guardados só no FlowLab e valem acima do apLIS.

**Blocked by:** 02, 04, 06

**Status:** ready-for-agent

- [ ] As edições são guardadas no Supabase com usuário e data, com RLS: só quem pode gerenciar o faturamento grava.
- [ ] O campo editado mostra a marca "editado manualmente".
- [ ] Cada edição vira evento no histórico, com usuário, valor anterior e valor novo.
- [ ] A sincronização não sobrescreve um campo editado e não gera evento de sincronização para ele.
- [ ] A data de envio editada recalcula retorno, pagamento e selo; a data real de retorno encerra o selo de atraso.
- [ ] Na lista, a data real aparece diferenciada da prevista.
- [ ] Valores editados entram na classificação e nos cards.
- [ ] Quem não pode gerenciar não vê o lápis.
- [ ] O teste do handler de sincronização confirma que um campo editado não é sobrescrito.
