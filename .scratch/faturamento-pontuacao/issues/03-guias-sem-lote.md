# 03: Guias sem lote

**What to build:** o critério "Guias sem lote" aparece na frente Faturamento. Ele dá 0,1 ponto para cada convênio que fechou o mês anterior sem nenhuma requisição pendente de lote. O detalhe lista os convênios "fechados sem pendência" e os "com pendência", como a planilha.

**Blocked by:** 01 (Bloco "Pontuação do setor" com a meta).

**Status:** done

- [x] Para a pontuação do mês M, olha as requisições solicitadas em M-1. A planilha de setembro avalia as guias de agosto.
- [x] Usa a mesma regra da aba Pendências → Sem lote: as mesmas fontes consideradas, sem Particular e sem Cortesia.
  - Se a condição de "sem lote" estiver presa na consulta paginada da aba, extraia-a antes, sem mudar o que a aba mostra.
- [x] Agrupa por fonte pagadora. Entra todo convênio com requisição solicitada em M-1. Cada convênio com 0 pendentes vale 0,1.
- [x] O detalhe mostra as duas listas, com o nº de requisições pendentes de cada convênio "com pendência".
- [x] Testes do módulo:
  - 12 convênios zerados dão exatamente 1,2;
  - convênio com pendência vai para a lista "com pendência" e não pontua;
  - mês sem requisições dá 0.
- [x] Conferido à mão: a lista "com pendência" bate com a aba Pendências → Sem lote filtrada pelo mesmo mês.

  Conferido em 27/10/2026 (pontuação de set/2026, guias de ago/2026): 25 convênios, 21 fechados sem pendência (2,1 pontos) e 4 com pendência — Bradesco Saúde 1, CBMDF 1, GEAP 2, Sul América 1 —, iguais por convênio à aba Sem lote filtrada em 01–31/08 (5 requisições).

**Decisão:** o universo do "entra todo convênio" usa as mesmas condições da aba, menos a pendência: fonte considerada, fora Particular e Cortesia, com procedimento e em estado cobrável. Um convênio só com requisições canceladas (estado não cobrável) não entra e não ganha 0,1 de graça.
