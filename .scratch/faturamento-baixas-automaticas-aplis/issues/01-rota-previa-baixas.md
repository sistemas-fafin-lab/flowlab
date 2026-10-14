# 01 — Rota da prévia das baixas do apLIS

**What to build:** a action `titulos-baixas-aplis-previa` que devolve, por
título divergente, as baixas a lançar segundo a regra da spec. Ver `../spec.md`
— seções "Regra das baixas sugeridas" e "Implementation Decisions".

**Blocked by:** None — can start immediately

**Status:** done

- [x] Recebido no apLIS por lote e por data (`DATE(DtaRecebido)`, `ValorRecebido > 0`) no `bdLab` de faturamento, em blocos de 1.000 lotes
- [x] Utilitário puro das baixas sugeridas, com teste vitest (casos da spec)
- [x] Action GET exigindo `canManageBilling`, só `so-no-aplis`/`aplis-maior`, título sem número como `pulado: 'sem-nota'`, `meta.dadoAte`; rota também no `vite.config.ts`
- [x] Teste vitest do handler: 401/403, pulado sem nota, tipos fora, 502

## Comments
- Implementado em `api/_lib/handlers/faturamento-titulos-baixas-aplis-previa.ts`,
  regra em `api/_lib/faturamento/baixasAplis.ts`, consulta `recebidosPorDataDosLotes`
  em `bdLab.ts` (conferida na réplica: lote 6329 → R$ 2.034,81 em 22/09/2026).
- A réplica roda com `only_full_group_by`: o GROUP BY repete o `DATE_FORMAT` do SELECT.
- Desvio deliberado da regra: o `so-no-aplis` também cai na baixa única com a
  diferença quando as datas não batem com o total (estorno negativo ou
  recebimento sem data no apLIS) — senão lançaria mais do que o recebido.
- Em aberto para a issue 02: título com número mas sem data de recebimento no
  apLIS volta com `baixas: []` e `pulado: null`; lote vinculado a dois títulos
  gera as mesmas baixas nos dois (mesmo comportamento da conferência).
