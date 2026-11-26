# 28 — Saúde das integrações

**What to build:** quem configura a EVA fica sabendo quando algo dela para, sem precisar perceber sozinho. Sugestão aceita pelo usuário em 24/Nov. O caso que motivou: o Granola ficou dias sem sincronizar em outubro, pela assinatura vencida, e só ele percebeu.

Plano: §2 (D39) e §11.8.

**Blocked by:** nada.

**Status:** done no código (24/Nov/2026). Falta aplicar a migration e publicar.

- [x] **Regras** (`domain/saude.ts`), com os mesmos limites dos chips do Início:
  - Granola com erro ou parado;
  - VPS sem sinal há mais de 15 min;
  - sessão do WhatsApp desconectada;
  - IA sem responder (3 falhas de vez em 2 h, nenhum acerto).
- [x] **Avisos:** um problema por linha em `ti_agente_saude`. O aviso sai na abertura, de novo a cada 24 h ("continua") e na resolução ("voltou").
- [x] **Por onde:** sino para quem configura; WhatsApp para quem configura e tem número, menos quando o problema é o próprio WhatsApp.
- [x] **Onde roda:** nos crons das 8h, 9h e 18h, sem derrubar o cron e sem rodar no `dryRun`.
- [x] O 403 `SUBSCRIPTION_INACTIVE` do Granola passa a dizer "a assinatura do workspace do Granola está inativa".
- [ ] Aplicar a migration `20261124153700_eva_saude_e_ausencias.sql` e publicar.
- [ ] Conferir o primeiro aviso de verdade no sino.

## Comments

**24/Nov/2026 — implementado no código.**
- **Testes:**
  - `domain/saude.test.ts`: cada problema, os limites e o texto;
  - `ti-agente/saude.test.ts`: abertura, silêncio antes de 24 h, "continua", resolução, VPS só no sino, `dryRun` e falha;
  - `granola.test.ts`: o 403 da assinatura.
- **Achado no teste com o Claude real:** a chave do `.env` local respondeu "credit balance is too low". Se for a mesma da Vercel, a EVA está só no Gemini até a recarga, e é exatamente o que o aviso `ia_fora` vai mostrar.
