# 33 — Triagem de todo chamado e base de conhecimento

**What to build:** todo chamado aberto pela tela vira sugestão de entrada no Kanban, como os do LAB-BRAIN, com o aviso de pedido repetido e a solução de um caso parecido. A EVA responde "como resolvemos…?" com as resoluções e rascunha a resolução a partir da conversa. Sugestões aceitas pelo usuário em 24/Nov ("Sugestão na fila").

Plano: §2 (D45) e §11.11.

**Blocked by:** 32 (o relógio da VPS roda a triagem).

**Status:** done no código (24/Nov/2026). Falta aplicar a migration, publicar e conferir.

- [x] **Triagem:** `triarChamadosNovos` no relógio (até 5 por volta), com a origem `triagem` e o aviso "Chamado novo para o Kanban".
- [x] **Recusar** a sugestão da triagem não cancela o chamado ("Não levar ao Kanban"); a do LAB-BRAIN continua cancelando.
- [x] **Repetido e solução anterior** na análise das duas origens (`promover-card-v2`), validados contra o que a IA recebeu e mostrados como avisos no cartão.
- [x] **Base de conhecimento** no chat do Início e no WhatsApp, quando a mensagem relata um problema.
- [x] **Rascunho da resolução:** rota `agente-rascunho` e o botão "Rascunhar com a EVA", com "Desfazer".
- [ ] Aplicar `20261124201700_eva_triagem_e_conhecimento.sql` no projeto do app.
- [ ] Abrir um chamado pela tela e conferir a sugestão na fila em até 10 min (depende do relógio, issue 32).
- [ ] Rascunhar a resolução de um chamado com conversa.

## Comments

**24/Nov/2026 — implementado no código.**
- **Conferido com a IA real, dados fictícios (pelo Gemini; o crédito da Anthropic estava zerado):**
  - o repetido e a solução anterior apareceram no pedido de VPN, e nenhum dos dois no pedido de monitor;
  - o rascunho usou só a conversa.
- **Testes:**
  - `domain/conhecimento.test.ts`: palavras, busca, gatilho e bloco;
  - `labBrainAnalise.test.ts`: o repetido e a solução validados e o conteúdo com o pedido fechando o texto;
  - `triagem.test.ts`: quem entra na triagem;
  - `rascunho.test.ts`: o que a IA recebe e as falhas.
