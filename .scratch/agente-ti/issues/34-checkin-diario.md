# 34 — Check-in diário

**What to build:** às 9h de dia útil, a EVA pergunta a cada membro com WhatsApp o que entra no dia e se há bloqueio. A resposta vira o plano do dia; o bloqueio vira comentário no card e aviso aos gestores. Às 10h, os gestores recebem o resumo. Uma daily sem reunião. Sugestão aceita pelo usuário em 24/Nov ("todos com WhatsApp").

Plano: §2 (D46) e §11.12.

**Blocked by:** 32 (o relógio da VPS dispara a pergunta e o resumo).

**Status:** done no código (26/Nov/2026). Falta aplicar a migration, publicar, ligar em Configurações e conferir.

- [x] **Pergunta** (`rodarCheckin`, das 9h às 12h): todo membro ativo com WhatsApp, fora quem está ausente, uma vez por dia, com os cards atrasados ou vencendo no radar.
- [x] **Resposta** (`responderCheckin`, antes da IA principal): o plano e os bloqueios, com o card achado pelo código ou pelo assunto. Outro assunto segue o fluxo normal. Confirmação montada pelo sistema.
- [x] **Bloqueio:** comentário no card e aviso aos gestores, como o "bloqueado" do WhatsApp.
- [x] **Resumo das 10h** para os gestores com "Recebe o relatório de gestão": bloqueios primeiro, quem respondeu, quem não respondeu e quem está fora.
- [x] **Configurações:** "Check-in diário", desligado por padrão. **Histórico do membro:** "Check-in do dia" e "Resumo do check-in".
- [ ] Aplicar `20261126172900_eva_checkin_diario.sql` no projeto do app.
- [ ] Ligar em Configurações e conferir a pergunta das 9h e o resumo das 10h num dia útil.

## Comments

**26/Nov/2026 — implementado no código.**
- **Conferido com a IA real, dados fictícios (pelo Gemini; o crédito da Anthropic estava zerado):** as 5 frases foram lidas certo, incluindo o card achado pelo assunto. "tem reunião hoje?" e "IT-045 concluída" não viraram check-in.
- **Testes:**
  - `domain/checkin.test.ts`: as janelas de horário, a fila, a pergunta, o resumo e a confirmação;
  - `ti-agente/checkin.test.ts`: quem é perguntado, uma vez por dia, o resumo uma vez, a leitura da resposta e o outro assunto;
  - `comandos.test.ts`: o check-in antes da IA principal.
