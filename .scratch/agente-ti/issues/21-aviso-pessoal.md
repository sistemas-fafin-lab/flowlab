# 21 — Aviso de gestor para uma pessoa, pelo chat e pelo WhatsApp

**What to build:** o usuário pediu, no chat do Início, que a EVA mandasse um aviso para um membro pelo WhatsApp, e ela respondeu que não conseguia. A ação não existia: só havia a cobrança de card atrasado e o aviso no grupo. Pedido do usuário (15/Out): "quando eu pedir para ela mandar um aviso ou uma mensagem para alguém, pelo chat ou por WhatsApp, ela deve atender".

Decisões do usuário:
- pelo chat e pelo WhatsApp;
- para qualquer membro ativo com WhatsApp. A adesão "Recebe cobrança" continua só para cobranças.

Só gestor (`canManageAgenteTI`, D31). A EVA mostra o texto e só envia com a confirmação.

Plano: §2 (D32) e §11.6.

**Blocked by:** 18, 19, 20.

**Status:** done no código (15/Out/2026); falta aplicar a migration, publicar e conferir com um aviso real

- [x] Migration `20261015140000_eva_aviso_pessoal.sql`: tipo `aviso` em `ti_agente_mensagens`, comando `avisar_pessoa` em `ti_agente_comandos`.
- [x] `api/_lib/ti-agente/aviso.ts`:
  - `checarAvisoPessoal`: gestor, WhatsApp ligado, pessoa ativa com WhatsApp;
  - `enviarAvisoPessoal`: fila, `enviada_por`, horário da EVA.
- [x] Rota `agente-avisar` (POST, gestor).
- [x] Chat:
  - `avisos` no schema;
  - instruções para atender "avisa/manda uma mensagem/fala para…";
  - "Quem pergunta" no contexto;
  - avisos só para gestor.
- [x] Cartão "Aviso pelo WhatsApp" no drawer, com texto editável, "Enviar pelo WhatsApp" e "Descartar"; mostra se sai já ou quando sai.
- [x] WhatsApp: intenção `avisar_pessoa` com prévia e SIM, conferida de novo no SIM.
- [x] O aviso entra na conversa recente de quem recebe; o histórico do membro mostra "Aviso de gestor"; a VPS segue o horário para `aviso`.
- [ ] Aplicar a migration no projeto do app.
- [ ] Conferir: um aviso pelo chat do Início e um pelo WhatsApp, recebidos no celular.

## Comments

**15/Out/2026 — implementado no código.**
- **Conferido com o Claude real, dados fictícios:**
  - no chat, "avisa o Gabriel que a reunião de amanhã mudou para as 10h" e "manda uma mensagem para o Bruno dizendo que…" voltaram como aviso para a pessoa certa, com o texto pronto;
  - no WhatsApp, "fala pro Gabriel que…" virou `avisar_pessoa`, e "me lembra amanhã às 8h de…" continuou lembrete.
- **Testes:**
  - EVA: 275, mais o do cartão;
  - novos: a conferência (gestor, desligado, fora da aba Membros, inativo, sem WhatsApp, sem exigir a adesão), o envio dentro e fora do horário, a validação do chat, o contexto, e o fluxo com SIM e as recusas pelo WhatsApp;
  - migration: 3 cenários novos no PGlite.
