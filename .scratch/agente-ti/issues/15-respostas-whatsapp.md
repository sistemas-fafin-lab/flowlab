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

**Status:** ready-for-agent

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
