# 26 — Gestor executa o próprio pedido, sem passar pela fila

**What to build:** pedido do usuário (04/Nov): "se o usuário for gestor, ele pode pedir para a eva executar ações diretamente, sem necessidade de ir para a fila de aprovação, tanto via chat quanto whatsapp".

Até aqui, só quem aprova sugestões (`canApproveAgenteTI`) confirmava e via a EVA aplicar na hora (D28, D31). O gestor (`canManageAgenteTI`) que não aprova mandava o pedido para a fila, como a equipe.

Plano: §2 (D37) e §11.4.

**Blocked by:** 11 (fila e RPCs), 16 (chat), 18 e 19 (WhatsApp), 20 (papéis).

**Status:** done no código (04/Nov/2026); falta aplicar a migration, publicar e conferir

- [x] **Banco** (migration `20261104120000_eva_aviso_equipe_gestor_direto.sql`):
  - `ti_agente_aprovar_sugestao_como`: quem aprova, qualquer sugestão; o gestor, só a dele (`proposta_por`), vinda do chat, de um comentário ou do WhatsApp;
  - `ti_agente_propor_sugestao`: o gestor propõe e, com `p_aprovar`, aplica na hora, em nome dele.
- [x] **Chat e comentários da EVA:** `podeExecutar` (quem aprova ou gestor) no lugar de `podeAprovar`; o botão é "Aprovar e executar". O contexto da IA diz se as propostas de quem pergunta entram ao confirmar ou vão para aprovação.
- [x] **WhatsApp:**
  - pedido de mudança: prévia e SIM também para o gestor;
  - andamento ("IT-045 concluída", "IT-052 vai para sexta"): do gestor ou de quem aprova, a EVA mostra o que vai aplicar e espera o SIM, em vez de mandar para a fila; quem aprova não é avisado no sino;
  - o SIM confere de novo: gestor ou quem aprova; sem os dois, não sai;
  - ajuda e "o que você faz" falam da mudança aplicada na hora.
- [ ] Aplicar a migration no projeto do app.
- [ ] Conferir com um gestor que não aprova: uma proposta pelo chat, uma pelo WhatsApp e um "IT-xxx concluída".

## Comments

**04/Nov/2026 — implementado no código.**
- **Interpretação, para confirmar com o usuário:**
  - "diretamente" é sem a fila, não sem confirmar: o cartão (chat) e o SIM (WhatsApp) continuam;
  - vale só para o pedido do próprio gestor. Sugestões de reunião e de outras pessoas continuam com quem aprova;
  - quem aprova também passou a ter o andamento que conta aplicado na hora, com SIM. Antes, ia para a fila como o de qualquer pessoa.
- **Chamado de usuário:** concluir pela EVA um chamado (não tarefa interna) continua barrado pela resolução obrigatória (`20261023120000_it_chamados_resolucao_anexos`). O SIM responde "Não consegui aplicar: … precisa de um texto de resolução".
- **Testes:**
  - `comandos.test.ts`: gestor que não aprova com prévia e SIM, andamento com SIM, SIM sem papel;
  - `respostas.test.ts`: a sugestão volta para o SIM, sem sino para quem aprova;
  - `chat.test.ts`: o contexto com "aplicadas" ou "aprovação";
  - migration: 12 cenários no PGlite (o próprio pedido pelo chat e pelo WhatsApp, o de outra pessoa, o de reunião, a equipe, quem aprova, sem papel, aplicar duas vezes).
