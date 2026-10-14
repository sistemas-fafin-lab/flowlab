# 15 — Respostas pelo WhatsApp

**What to build:** a conversa.
- O WAHA chama `waha-webhook` a cada mensagem recebida.
- O handler valida a origem, ignora grupos, `fromMe` e números desconhecidos (RN13), grava a mensagem e responde 200 rápido.
- Em seguida, o `gerarEstruturado` (Claude Sonnet 5.5 com `effort: 'low'`, Gemini 3.8 Flash de reserva) interpreta o texto com os cards abertos **daquele membro** como contexto.
- Se os dois provedores falharem, a mensagem fica registrada sem interpretação, para tratamento manual, e o agente responde que recebeu e que a equipe vai ver no Início (plano §9.1).
- Do resultado saem um comentário no card citado (autor: o próprio membro, prefixo "via WhatsApp") e, se houver pedido de mudança (concluir, adiar, bloquear), uma sugestão na fila (D12).
- Por fim, o agente enfileira a confirmação do que entendeu.

**Decisão a registrar nesta issue: como validar o webhook.** O preferido é o HMAC SHA-512 do WAHA sobre o corpo cru. O dispatcher entrega o corpo já convertido em JSON, então é preciso confirmar se dá para ler o corpo cru só nessa ação. Se não der, a alternativa aceita é um token secreto na URL (HTTPS), mais a conferência do remetente na lista de membros (§11.3).

Plano: §2 (D12), §4.3 (RF22), §4.4 (RN13, RN15), §5 (Fluxo 3) e §11.3.

**Blocked by:** 11, 13, 14.

**Status:** done no código (14/Out/2026); falta configurar o webhook no WAHA e conferir uma resposta real (13)

- [ ] Ação `waha-webhook`: validação (HMAC ou token, a decisão vai nos comentários), RN13 e gravação idempotente por `waha_message_id`.
- [ ] Interpretação depois da resposta 200, com `waitUntil` se o runtime oferecer. Senão, processar antes de responder e confirmar que cabe no tempo do WAHA.
- [ ] `api/_lib/ti-agente/respostas.ts`:
  - chamada só via `gerarEstruturado({ finalidade: 'resposta_whatsapp', esforco: 'low', mensagemId, … })`;
  - schema zod (card citado, intenção, nova data, texto do comentário);
  - card citado precisa estar entre os do membro;
  - sem card identificado, o agente pergunta qual é ("Não achei o card. Qual o código?");
  - testes com cliente falso.
- [ ] Comentário em `it_task_comments` com `user_id` = membro; sugestão com `mensagem_id` preenchido.
- [ ] Confirmação na fila (`tipo = 'confirmacao'`).
- [ ] **Entregue / Lida** (RF26):
  - o webhook também trata `message.ack` e atualiza a mensagem de saída de mesmo `waha_message_id` para `entregue` ou `lida`, sem voltar para trás;
  - a fila do Início mostra os selos do handoff.
  - A sessão precisa assinar `message.ack` (issue 13).
- [ ] Testes: assinatura ou token errado volta 401; grupo e número desconhecido são ignorados; entrega repetida não duplica.

## Comments

**14/Out/2026 — decisão: token na URL, não HMAC.**
- O HMAC do WAHA é calculado sobre o corpo cru, e a Vercel entrega o corpo já convertido em JSON. Recalcular sobre `JSON.stringify(req.body)` não reproduz os bytes originais.
- Ficou a alternativa prevista: `POST /api/ti/waha-webhook?token=<WAHA_WEBHOOK_SECRET>` por HTTPS. O token é comparado em tempo constante (SHA-256 dos dois lados, então o tamanho não vaza), e o remetente precisa estar na lista de membros.
- Sem `WAHA_WEBHOOK_SECRET`, a rota responde 503.

**14/Out/2026 — implementado no código.**
- **`api/_lib/ti-agente/webhook.ts`** (puro, 6 testes):
  - `lerEvento` ignora grupos, listas, canais, `fromMe` e outra sessão;
  - remetente em LID usa o número de `_data.key.senderPn` ou `remoteJidAlt`, quando o engine manda;
  - `acharMembro` aceita o número com e sem o 9º dígito, pelo cadastro ou pelo `whatsapp_chat_id`.
- **`ti-waha-webhook.ts`:**
  - grava a recebida com `waha_message_id` único. A repetida volta 200 com `repetida: true` e não é reinterpretada;
  - número desconhecido fica `ignorada`, sem resposta (RN13);
  - a interpretação roda em `waitUntil` (`@vercel/functions`, como em `receive-agendamento`). Fora da Vercel, a promessa termina sozinha;
  - `message.ack`: 2 = entregue, 3 ou 4 = lida, sem voltar para trás. O status antigo é conferido no `update`, para dois acks seguidos não se atropelarem.
  
  7 testes da rota.
- **`api/_lib/ti-agente/respostas.ts`:**
  - contexto: só os cards abertos do membro, mais a última cobrança enviada a ele;
  - schema `{ itens: [{ card_codigo, intencao, nova_data, prazo_texto }], confianca }`, com até 5 cards;
  - **concluir** vira sugestão "coluna → Concluído"; **adiar** com data válida, de hoje em diante e diferente do prazo atual, vira sugestão de prazo;
  - **bloquear** vira comentário e aviso no sino aos gestores, sem sugestão: o card não tem campo de bloqueio;
  - **atualizar** vira só comentário.
- **Comentário no card:** o autor é o membro e o texto é a mensagem original, com o prefixo "via WhatsApp:". São as palavras da pessoa, não as da IA.
- **Sugestões:** `origem = 'whatsapp'`, com `mensagem_id` e `proposta_por`.
- **Confirmação:** modelo fixo, como "Obrigada, Bruno! IT-045: anotei que está concluída. A mudança de status vai para aprovação."
- **Mensagens prontas:** card não identificado responde "Não achei o card. Qual o código?". Os dois provedores falhando deixam o erro registrado e respondem "não consegui ler agora". Mídia sem texto pede texto. Membro sem cards abertos também tem resposta própria.
- **Limite:** 20 mensagens por membro por dia. Acima disso, a mensagem fica registrada sem interpretação e sem resposta, o que evita laço com robô de resposta automática.
- **Testes:** 6, entre eles o caminho completo: comentário, sugestão e confirmação, sem nenhuma escrita em `it_requests`, só com os cards do membro no contexto.
- **Selos Entregue/Lida** no Início, pela fila (12).
- **Falta:** configurar o webhook no WAHA com o token (13) e conferir uma resposta real.
