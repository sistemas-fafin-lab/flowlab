# 01: Particulares e Sem lote até hoje, sem estados não cobráveis

**What to build:** Em Pendências → Particulares e Pendências → Sem lote, o operador acompanha o mês corrente: o filtro de solicitação vai até **hoje** (não mais até o fim de M-1) e abre por padrão no mês corrente (dia 1 até hoje). O subtítulo das duas abas diz que os dados são até D-1, porque a réplica do apLIS atrasa cerca de um dia. As requisições em estado final não cobrável somem das duas listas e dos totais: **8** Exame Cancelado, **64** Amostra DEVOLVIDA, **1023** Material Encaminhado p/ Descarte Definitivo, **1037** Amostra Encaminhada p/ Descarte/Sem Contato com Paciente. **1020** (Aguardando devolução/retirada) e **1034** (Aguardando descarte) continuam aparecendo. Pendências → Sem NF (lotes) **não muda**: continua limitada a M-1.

Prefactor primeiro: a regra de janela M-1, hoje compartilhada pelas três listas, passa a valer só para Sem NF (lotes). Particulares e Sem lote ganham o limite "até hoje", calculado no MySQL a partir de `CURDATE()`. O `ate` do cliente continua só podendo encurtar a janela. O corte isolado de `CodEvento = 8` de Sem lote vira um conjunto nomeado de eventos não cobráveis, compartilhado pelas duas listas.

Spec: `.scratch/faturamento-pendencias-e-refechamento/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Particulares e Sem lote aceitam `ate` até hoje. Um `ate` futuro é limitado a hoje, e a meta da resposta informa esse limite no lugar do cutoff de M-1.
- [x] Sem NF (lotes) continua limitada ao fim de M-1, sem mudança de comportamento.
- [x] As duas abas abrem por padrão em 01/mês corrente → hoje, e o subtítulo diz "dados até ontem (D-1)".
- [x] Os eventos 8, 64, 1023 e 1037 saem da lista e do total de Particulares e de Sem lote. Os eventos 1020 e 1034 continuam.
- [x] O widget-resumo do Dashboard que usa o total de Particulares reflete a nova regra.
- [x] Os testes dos handlers seguem passando ou foram ajustados para o novo limite (bdLab mockado). _Não existem testes para esses dois handlers; os de handler entram com a issue 02._
- [x] Conferido à mão no banco real: Sem lote de ago/2026 sem as requisições com evento 64/1023, e Particulares de out/2026 sem exame cancelado e com requisições do mês corrente.

**Conferência no banco real (19/10/2026):** Sem lote de ago/2026 perde 11 requisições com evento 64 e 3 com 1023 (e 26 de exame cancelado, que já saíam); as 4 com evento 1020 continuam. Particulares de out/2026 com a regra nova: 47 requisições, a última de 16/10 (atraso da réplica), nenhuma com exame cancelado.
