# 16 — Chat com a EVA e ditado por voz

**What to build:** o chat do protótipo funcionando de verdade.
- O drawer (`EvaChatDrawer`), a barra flutuante (`EvaFloatingChat`), o campo do hero e as sugestões passam a responder pela ação nova `agente-perguntar`.
- O ditado por voz (`useVoiceInput`, Web Speech API) é ligado nos três lugares.

A EVA **responde e propõe; executa só com aprovação prévia** (D20, D28, RN17):
- responde sobre o board, os projetos, a última reunião e a fila, citando cards pelo código;
- quando pedem uma mudança de card ("move o IT-045 para revisão", "passa o IT-052 para o Diego"), devolve uma **proposta** que aparece no drawer como cartão com antes → depois:
  - para gestor: "Aprovar e executar";
  - para os demais: "Enviar para aprovação";
  - os dois chamam `ti_agente_propor_sugestao` (11);
- cobrança não é proposta pelo chat: ela indica o botão Cobrar.

As respostas fixas do protótipo (`domain/chatReplies.ts`, `cannedReply`) saem. Os helpers de data do mesmo arquivo ficam.

Plano: §2 (D20, D26), §4.2 (RF23, RF24), §4.4 (RN17), §9.1, §9.5, §12.3 e §14.5.

**Blocked by:** 03, 06. Os cartões de proposta precisam da 11 (RPC) e do diálogo de confirmação da 17. A 08 deixa o contexto mais rico (resumo da última reunião), mas não bloqueia: sem reunião analisada, o contexto vai sem ela.

**Status:** ready-for-agent

- [ ] `api/_lib/ti-agente/chat.ts`:
  - monta o contexto, com cards abertos um por linha, projetos e sprints, o resumo da última reunião analisada e as últimas mensagens da fila;
  - na Minha visão, só o que é da pessoa;
  - instruções em pt-BR, com o contexto entre marcas e tratado como dado (RN15);
  - schema `{ resposta, cards_citados, propostas }`, em que `propostas` usa o mesmo formato das sugestões de reunião (§9.3), validado pela mesma §9.4;
  - códigos citados que não existem no contexto saem da resposta.
- [ ] Chamada só via `gerarEstruturado({ finalidade: 'chat', esforco: 'low', userId, … })`.
  - Cache de prompt no bloco de contexto: instruções e contexto primeiro, pergunta e histórico depois.
  - Conferir `cache_read_input_tokens` em perguntas seguidas.
- [ ] Ação `agente-perguntar`:
  - POST com sessão e `canManageIT`;
  - corpo `{ pergunta, visao, historico }`, com as últimas 6 mensagens;
  - limite de 30 perguntas por pessoa por dia, contado em `ti_agente_chamadas_ia`. Ao passar, responde 429 com "Você chegou ao limite de perguntas de hoje".
- [ ] `evaService.ask` chama a ação; o `useEvaChat` passa a mandar o histórico e a visão.
- [ ] Mensagem inicial do drawer gerada no cliente, sem IA: saudação + "Li o board e a última reunião (dd/mm)" quando houver.
- [ ] Erro dos dois provedores: a mensagem do handoff, "Não consegui consultar o board agora. Tente novamente em alguns segundos."
- [ ] Voz:
  - `useVoiceInput` como veio no handoff, com o microfone visível no hero, no drawer e na barra flutuante;
  - as mensagens de erro do handoff (navegador sem suporte, permissão negada, sem fala, sem microfone, sem rede).
- [ ] Testes:
  - `chat.test.ts` com `gerarEstruturado` falso: contexto da Minha visão sem cards dos outros; código inexistente removido; pedido de mudança vira proposta e **nada** é escrito até a confirmação;
  - limite diário: a 31ª pergunta recusada.

## Comments
