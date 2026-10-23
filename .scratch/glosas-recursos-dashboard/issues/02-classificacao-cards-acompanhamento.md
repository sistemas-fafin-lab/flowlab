# 02: Classificação das requisições e cards do Acompanhamento

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** cada requisição recursada é classificada em em análise, deferido, deferido parcial (em tratativa), indeferido ou glosa acatada, seguindo o spec (R = valor recursado; ΔRec = recebido atual − recebido na fixação). O topo do Acompanhamento ganha os cards Total de recursos (com variação em relação ao mês anterior), Em análise, Deferidos e Indeferidos (com percentual do total). Os valores de deferido parcial e de glosa acatada também ficam visíveis.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Em análise: lote de recurso enviado e ΔRec = 0.
- [ ] Deferido: ΔRec ≥ R.
- [ ] Deferido parcial: 0 < ΔRec < R.
- [ ] Indeferido: status 15.
- [ ] Glosa acatada: status 18 ou 8, valendo o saldo negativo da requisição.
- [ ] A classificação aceita valores editados à mão (a edição é feita no ticket 07) com prioridade sobre o apLIS.
- [ ] Os 4 cards e os valores de deferido parcial e acatada respeitam o período e o convênio do cabeçalho.
- [ ] A variação do Total é em relação ao mês de faturamento anterior.
- [ ] Testes do módulo de regras cobrem cada classificação, incluindo o limite ΔRec = R e a prioridade do valor editado.
