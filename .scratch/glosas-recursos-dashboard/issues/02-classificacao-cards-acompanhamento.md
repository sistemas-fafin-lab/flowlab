# 02: Classificação das requisições e cards do Acompanhamento

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** cada requisição recursada é classificada em em análise, deferido, deferido parcial (em tratativa), indeferido ou glosa acatada, seguindo o spec (R = valor recursado; ΔRec = recebido atual − recebido na fixação). O topo do Acompanhamento ganha os cards Total de recursos (com variação em relação ao mês anterior), Em análise, Deferidos e Indeferidos (com percentual do total). Os valores de deferido parcial e de glosa acatada também ficam visíveis.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Em análise: lote de recurso enviado e ΔRec = 0.
- [x] Deferido: ΔRec ≥ R.
- [x] Deferido parcial: 0 < ΔRec < R.
- [x] Indeferido: status 15.
- [x] Glosa acatada: status 18 ou 8, valendo o saldo negativo da requisição.
- [x] A classificação aceita valores editados à mão (a edição é feita no ticket 07) com prioridade sobre o apLIS.
- [x] Os 4 cards e os valores de deferido parcial e acatada respeitam o período e o convênio do cabeçalho.
- [x] A variação do Total é em relação ao mês de faturamento anterior.
- [x] Testes do módulo de regras cobrem cada classificação, incluindo o limite ΔRec = R e a prioridade do valor editado.

## Comments

**Implementado (23/10/2026).** Decisões tomadas na implementação, para revisar:

- **Total de recursos** = requisições em algum lote de recurso (enviado ou não); valor = Σ recursado. Em análise, Deferidos, Indeferidos e deferido parcial contam só essas requisições.
- **Glosa acatada** conta todas as requisições da foto em 18 ou 8, com ou sem recurso (história 30: "quanto o laboratório decidiu não recorrer").
- **Percentuais e variação** são sobre a quantidade de requisições; o número grande do card é o valor em reais. O rodapé diz "das requisições em recurso".
- **Precedência:** status 15/18/8 vale acima do ΔRec e do lote não enviado. Lote não enviado, sem esses status, fica sem classificação (história 35).
- **Deferido** exige ΔRec > 0: com R = 0 e nada recebido, a requisição fica em análise.
- **Deferido parcial** traz também o pendente (R − ΔRec), o valor "a cobrar" da história 29.
- **34/17 sem lote** (glosa fixada em branco) é classificado como deferido com valor 0 até o lápis, mas não entra nos cards do Acompanhamento, que contam só requisições em lote. Vai para "Revertidas" no Dashboard (ticket 11).
- **Edições manuais:** `classificarRequisicao` já aceita `valorRecursado` e `valorRecebidoGlosa` editados. O handler `glosas-recursos-resumo` ainda não lê edições; o ticket 07 deve preencher `edicoes` e usar a data de envio editada do lote em `loteEnviado`.
- Não deu para conferir números reais: a foto ainda está vazia no Supabase (nenhuma sincronização feita).
