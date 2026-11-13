# 04: A EVA analisa o pedido com IA

**What to build:** a proposta da sugestão de promoção passa a vir da EVA. Ela lê o pedido do LAB-BRAIN e propõe coluna, prioridade, responsáveis do TI e prazo, com uma justificativa curta que quem aprova vê no cartão. Se a IA falhar, vale a regra fixa da 01. Ver `../spec.md`: Rota de criação (Montagem da sugestão) e as histórias 13, 23 a 27.

**Blocked by:** 01

**Status:** done

- [x] A análise usa o caminho de IA estruturada da EVA (Claude com o Gemini de reserva) e o registro de chamadas que já existe.
- [x] O prompt é versionado e trata título e descrição como dado, nunca como instrução (D12).
- [x] O contexto mandado é só a lista de membros do TI e o pedido.
- [x] A proposta traz coluna, prioridade, responsáveis, prazo e justificativa. Não traz projeto nem sprint.
- [x] A saída é validada com a regra das outras sugestões. Responsáveis fora do TI e colunas ou prioridades desconhecidas são descartados.
- [x] IA com erro, com timeout ou com saída inválida cai na regra fixa, com a marca "sem análise".
- [x] A justificativa aparece no cartão da sugestão `promover_card`.
- [x] Testes pela rota de criação, com a IA simulada:
  - a proposta da IA é gravada já validada, e um responsável fora do TI some;
  - erro da IA gera a regra fixa;
  - saída inválida gera a regra fixa;
  - o texto do chamado chega à IA como dado.
- [x] Migration aplicada no banco de teste (`eqz`).

## Notas da implementação

- Prompt, schema, contexto e validação ficam em `api/_lib/labBrainAnalise.ts`. A chamada à IA e a regra fixa ficam em `api/_lib/labBrainSugestao.ts`. A rota passa `dependenciasIA(supabase)`, que é o mesmo Claude com Gemini de reserva e o mesmo registro em `ti_agente_chamadas_ia`.
- O registro de chamadas ganhou a finalidade `analise_chamado` (migration `20261113180000_eva_chamadas_ia_analise_chamado.sql`, que só troca o CHECK). Na aba Configurações, ela aparece como "Chamados do LAB-BRAIN".
- Versão do prompt: `VERSAO_PROMPT_PROMOVER = 'promover-card-v1'`, gravada em `proposta.versao_prompt`. A regra fixa não grava a versão.
- Texto como dado: título e descrição vão dentro de `<chamado>…</chamado>`, e um `</chamado>` escrito pelo solicitante perde o `<`. O contexto é só a lista `MEMBROS DO TI` (`lerMembros`), sem cards, projetos nem sprints. Para prazos relativos, o conteúdo leva a data do pedido (Brasília).
- Validação, com a mesma regra de `validarSugestoes`:
  - quem está fora de `lerMembros` sai, com um aviso;
  - prazo que não é uma data `AAAA-MM-DD` válida é descartado, com um aviso;
  - coluna e prioridade fora da lista são recusadas pelo `z.enum` do schema. Com isso, a análise inteira cai na regra fixa;
  - justificativa vazia também cai na regra fixa.
- Tempo limite de 280 s para a análise inteira. Esse tempo cabe o pior caso do Claude (90 s com uma nova tentativa) e o do Gemini (90 s). `vercel.json` ganhou `maxDuration` de 300 s em `api/integracoes/*.ts`.
- A confiança agora vem da IA. A regra fixa continua `baixa`. Uma análise com confiança `alta` entra no "Aprovar as de confiança alta" da tela de Sugestões.
- A justificativa já aparecia no cartão desde a issue 01 (`SugestaoCard`). A tela não precisou mudar.

