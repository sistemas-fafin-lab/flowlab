# 04: A EVA analisa o pedido com IA

**What to build:** a proposta da sugestão de promoção passa a vir da EVA. Ela lê o pedido do LAB-BRAIN e propõe coluna, prioridade, responsáveis do TI e prazo, com uma justificativa curta que quem aprova vê no cartão. Se a IA falhar, vale a regra fixa da 01. Ver `../spec.md`: Rota de criação (Montagem da sugestão) e as histórias 13, 23 a 27.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A análise usa o caminho de IA estruturada da EVA (Claude com o Gemini de reserva) e o registro de chamadas que já existe.
- [ ] O prompt é versionado e trata título e descrição como dado, nunca como instrução (D12).
- [ ] O contexto mandado é só a lista de membros do TI e o pedido.
- [ ] A proposta traz coluna, prioridade, responsáveis, prazo e justificativa. Não traz projeto nem sprint.
- [ ] A saída é validada com a regra das outras sugestões. Responsáveis fora do TI e colunas ou prioridades desconhecidas são descartados.
- [ ] IA com erro, com timeout ou com saída inválida cai na regra fixa, com a marca "sem análise".
- [ ] A justificativa aparece no cartão da sugestão `promover_card`.
- [ ] Testes pela rota de criação, com a IA simulada:
  - a proposta da IA é gravada já validada, e um responsável fora do TI some;
  - erro da IA gera a regra fixa;
  - saída inválida gera a regra fixa;
  - o texto do chamado chega à IA como dado.
