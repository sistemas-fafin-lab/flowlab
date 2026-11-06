# 07: Matriz por convênio e conversão de requisições

**What to build:** na aba Comparativos: (a) matriz **faturado × glosado × recebido** por convênio nos 3 meses; (b) **conversão** de requisições: aptas (cadastradas no mês, convênio cobrável, fora Particular/Cortesia, evento cobrável, com procedimento) × faturadas (lote fora de cancelado e prejuízo), com % e "aptas sem lote". Sem prazo de perda de janela. Ver `../spec.md`.

**Blocked by:** 03, 04

**Status:** ready-for-agent

- [ ] A matriz bate com o funil agregado do mesmo mês.
- [ ] A conversão exclui particular, cortesia, lote cancelado e lote em prejuízo.
- [ ] "Aptas sem lote" bate com a sub-aba "Sem lote" no mesmo recorte quando aplicável.
- [ ] Testes de função pura e de rota; `npm test` e typecheck passam.
