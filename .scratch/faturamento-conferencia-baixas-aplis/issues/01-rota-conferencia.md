# 01 — Rota de conferência das baixas com o apLIS

**What to build:** a leitura de ponta a ponta no backend. Uma action nova
devolve os títulos cujo recebido no sistema diverge do recebido no apLIS. Ver
`../spec.md` — seções "Fonte do recebido no apLIS", "Comparação" e "Backend".

**Blocked by:** None — can start immediately

**Status:** needs-triage

- [x] Função no `bdLab` de faturamento: por `IdLote`, `fatlote.Status`,
      `SUM(ValorRecebido)` e `MIN/MAX(DtaRecebido)` de
      `fatrequisicaoprocedimento` via `requisicao.Lote`; datas com
      `DATE_FORMAT`; blocos de até 1.000 ids; sem cache
- [x] Utilitário puro de classificação (`so-no-aplis`, `aplis-maior`,
      `sistema-maior`, `lote-ausente`, tolerância de R$ 1,00), com teste vitest
- [x] Action `titulos-conferencia-aplis` (GET) no dispatcher, exigindo
      `canViewBilling`; títulos não cancelados e seus lotes lidos no Supabase
      com o cliente do usuário; resposta só com divergentes + `meta.dadoAte`
- [x] Falha na réplica → 502 com mensagem clara
- [x] Teste vitest do handler (mocks de `bdLab` e Supabase): 401/403, os
      quatro tipos, tolerância, cancelado fora, título com 2 lotes, 502
- [ ] Conferência ao vivo contra o levantamento de 14/10 (112 abertas, 119
      parciais com diferença, 3 lotes ausentes)

## Comments

- 14/10 — implementado (`recebidosDosLotes` em `api/_lib/faturamento/bdLab.ts`,
  `api/_lib/faturamento/conferenciaAplis.ts`, handler
  `faturamento-titulos-conferencia-aplis.ts`, rota também no `vite.config.ts`).
  Decisões além da spec:
  - resposta leva também `dataEmissao` (coluna "emissão" do modal da 02);
  - `primeiro/ultimoRecebimentoAplis` só contam procedimento com
    `ValorRecebido > 0` — glosa total não puxa a data do depósito;
  - título com algum lote sem `aplis_id` fica fora (o recebido do apLIS seria
    de só parte dele);
  - `so-no-aplis` também respeita a tolerância (apLIS ≥ R$ 1,00);
  - um lote ausente no MySQL torna o título inteiro `lote-ausente`;
  - `statusAplis` é o rótulo STLOT; `meta.dadoAte` = maior
    `requisicao.DtaSolicitacao` (cache de 30 min do `dadoAte`, só o recebido é
    sem cache); ordenado por tipo e maior diferença.
  - Conferência ao vivo **pendente**: a leitura de produção foi bloqueada pela
    permissão da sessão. Conferido só o lote 6329 no MySQL (R$ 2.034,81 em
    22/09, bate com a spec) e que 4905 não existe lá.

