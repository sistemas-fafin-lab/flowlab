# 04: Conferência detecta título com lote refechado

**What to build:** Ao clicar em **Atualizar** na aba Títulos, a conferência com o apLIS (a mesma leitura que já alimenta os selos "Divergente do apLIS") também aponta os títulos cujo lote foi **refechado** no apLIS depois da emissão. A página mostra um aviso "N títulos com lote refechado no apLIS", listando operadora, lote(s), emissão atual → fechamento mais recente. Este ticket só aponta e **não muda dado**. A aplicação automática fica no ticket 05.

Regra: para cada título não cancelado cujos lotes têm todos `aplis_id`, pegar o **fechamento mais recente** entre os lotes no apLIS (`fatlote.DtaFechamento`). Se todos os lotes estão fechados e esse fechamento cai num **mês posterior** ao da `data_emissao`, o título é refechado (diferença só de dia no mesmo mês não conta — ver Comments). Vale também para títulos do backfill e de emissão manual. A conferência devolve `refechamentos: { idNota, lotes, emissaoAtual, emissaoNova }[]`, separado das divergências de recebido.

Contexto: em out/2026, os lotes 6243, 6283, 6395, 6553 e 6774 (cerca de R$ 51,7 mil) têm título no FlowLab com emissão de jul/ago/set, mas foram refechados em outubro no apLIS. O 6111 **não** deve aparecer, porque o fechamento dele no apLIS é de julho.

Spec: `.scratch/faturamento-pendencias-e-refechamento/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human — código pronto e regra conferida contra os dados de produção; falta ver o aviso na tela depois do deploy.

- [x] A resposta da conferência traz `refechamentos` com emissão atual e nova.
- [x] Título com fechamento em mês posterior à emissão aparece. Fechamento no mesmo mês ou anterior não aparece.
- [x] Título com vários lotes usa o fechamento mais recente. Título com algum lote sem fechamento não aparece.
- [x] Título cancelado e título com lote sem `aplis_id` não aparecem.
- [x] O Atualizar da aba Títulos mostra o aviso com a lista. Sem refechamentos, nenhum aviso.
- [x] Testes do handler da conferência (bdLab e Supabase mockados) cobrindo os casos acima. Prior art: testes atuais do handler e de `conferenciaAplis`.
- [x] Conferido à mão: a lista em produção traz 6243, 6283, 6395, 6553 e 6774, e não traz 6111.

## Comments

**19/10/2026 — implementação.** O `recebidosDosLotes` passou a trazer `fechamento` (`fatlote.DtaFechamento`), e a regra está em `refechamentoDoTitulo` (`api/_lib/faturamento/conferenciaAplis.ts`). A resposta traz `refechamentos: { idNota, operadora, lotes, emissaoAtual, emissaoNova }[]`. O aviso fica acima da lista da aba Títulos (`RefechamentosAplisAviso`) e aparece sempre que a conferência roda (entrada na aba e Atualizar).

**Regra mudou de dia para mês.** Pela regra por dia, o 6111 aparecia (emissão 08/07 no FlowLab, fechamento 09/07 no apLIS), contra o critério de aceite. Em produção, a regra por dia dava 37 títulos, 15 deles só com o dia diferente no mesmo mês. Decidido com o usuário: conta só quando muda o mês.

**Conferência em produção (19/10/2026, Supabase de prod + réplica):** 22 títulos. Estão os 5 lotes esperados (6243, 6283, 6395, 6553, 6774), o 6111 não está, e há mais um que vai para outubro: **5424** SIS SENADO (10/09 → 05/10). Os outros 16 movem meses anteriores (4924 fev→mai; 5354 abr→mai; 5708, 5816, 5839, 5840 STJ mai→jun; 5773, 5776 mai→jun; 5804 mai→jul; 6094 jun→jul; 4951 ago→set; 6534, 6535, 6546, 6554, 6556 TJDFT ago→set). O ticket 05 vai mexer no histórico de metas desses meses também.
