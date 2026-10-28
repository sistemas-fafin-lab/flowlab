# 04: Zero glosa

**What to build:** o critério "Zero glosa" aparece na frente Faturamento. Ele dá 0,5 ponto para cada convênio que recebeu pagamento no mês sem nenhuma requisição glosada. O detalhe lista os convênios recebidos com e sem glosa.

**Blocked by:** 01 (Bloco "Pontuação do setor" com a meta).

**Status:** done (28/Out/2026; conferido contra a lista de recebidos de set/2026); falta comparar com o Dashboard de Glosas e Recursos na tela

- [x] Fatos: as requisições com recebimento registrado no apLIS no mês M, agrupadas por fonte pagadora. Cada convênio é marcado como "teve glosa" quando alguma dessas requisições foi glosada.
  - A glosa segue a definição já usada no módulo de Glosas e Recursos. Não crie uma segunda definição.
- [x] Convênio sem recebimento no mês fica fora da conta. Cada convênio sem glosa vale 0,5.
- [x] Testes do módulo:
  - 6 convênios sem glosa dão 3;
  - uma única requisição glosada tira o ponto do convênio;
  - convênio sem recebimento não aparece em nenhuma das listas.
- [ ] Conferido à mão para setembro/2026, contra o Dashboard de Glosas e Recursos e a lista de recebidos do mês.

  Conferido em 27/10/2026 contra a lista de recebidos do mês (`listarRecebidosMes`, set/2026): os 19 convênios considerados e o nº de requisições recebidas de cada um batem. Resultado: 11 sem glosa (5,5 pontos) e 8 com glosa — Bradesco 005711 396, Bradesco 421715 27, CASSI 13, INAS GDF 5, PMDF 667, STF 24, Sul América 15, TRT 1. Falta abrir o Dashboard de Glosas e Recursos na tela; a glosa usa o mesmo SQL do módulo (`SQL_REQUISICAO_GLOSADA`), não uma cópia.

**Decisões:**

- Recebimento = o da lista de recebidos do mês: `fatrequisicaostatus.DtaRecebido` no mês. O convênio entra na conta com pelo menos uma requisição paga (`VlrRecebido > 0`). Uma baixa zerada no mês (glosa total) conta como glosada, mas sozinha não põe o convênio na conta.
- Mesmo recorte de fontes das guias sem lote: fontes consideradas na meta, sem Particular e Cortesia. É também o recorte que o widget "Recebido no mês" faz no cliente; sem ele, set/2026 teria mais 7 fontes pequenas (ASSEFAZ, Mater Clínica, CDI Gama, Ginorte, ABAC, Amil, COEM), quase todas sem glosa.
- A glosa é o status de hoje no backup, como a pendência das guias sem lote; o Fechamento congela o número.
- Seguindo a definição única, requisição recebida em status de recurso pago (34 glosa recebida, 17 recurso pago) conta como glosada. Em set/2026 isso decide Bradesco 005711 e Sul América, que só têm glosas nesse status. Se a coordenação quiser só glosa nova, isso muda a definição e vale decidir para o módulo de Glosas e Recursos também.
