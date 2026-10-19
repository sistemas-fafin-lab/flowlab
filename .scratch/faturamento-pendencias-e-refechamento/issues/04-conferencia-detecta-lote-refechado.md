# 04: Conferência detecta título com lote refechado

**What to build:** Ao clicar em **Atualizar** na aba Títulos, a conferência com o apLIS (a mesma leitura que já alimenta os selos "Divergente do apLIS") também aponta os títulos cujo lote foi **refechado** no apLIS depois da emissão. A página mostra um aviso "N títulos com lote refechado no apLIS", listando operadora, lote(s), emissão atual → fechamento mais recente. Este ticket só aponta e **não muda dado**. A aplicação automática fica no ticket 05.

Regra: para cada título não cancelado cujos lotes têm todos `aplis_id`, pegar o **fechamento mais recente** entre os lotes no apLIS (`fatlote.DtaFechamento`). Se todos os lotes estão fechados e esse fechamento é **posterior** à `data_emissao`, o título é refechado. Vale também para títulos do backfill e de emissão manual. A conferência devolve `refechamentos: { idNota, lotes, emissaoAtual, emissaoNova }[]`, separado das divergências de recebido.

Contexto: em out/2026, os lotes 6243, 6283, 6395, 6553 e 6774 (cerca de R$ 51,7 mil) têm título no FlowLab com emissão de jul/ago/set, mas foram refechados em outubro no apLIS. O 6111 **não** deve aparecer, porque o fechamento dele no apLIS é de julho.

Spec: `.scratch/faturamento-pendencias-e-refechamento/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A resposta da conferência traz `refechamentos` com emissão atual e nova.
- [ ] Título com fechamento posterior à emissão aparece. Fechamento igual ou anterior não aparece.
- [ ] Título com vários lotes usa o fechamento mais recente. Título com algum lote sem fechamento não aparece.
- [ ] Título cancelado e título com lote sem `aplis_id` não aparecem.
- [ ] O Atualizar da aba Títulos mostra o aviso com a lista. Sem refechamentos, nenhum aviso.
- [ ] Testes do handler da conferência (bdLab e Supabase mockados) cobrindo os casos acima. Prior art: testes atuais do handler e de `conferenciaAplis`.
- [ ] Conferido à mão: a lista em produção traz 6243, 6283, 6395, 6553 e 6774, e não traz 6111.
