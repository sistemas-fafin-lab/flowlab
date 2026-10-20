# 04 — E-mails e card na Home

**What to build:** e-mail "SC aguardando sua aprovação" ao aprovador quando
a SC recebe `approver_id` (criação, backfill não dispara, recálculo do RH
dispara), com link para a lista filtrada; e-mail de rejeição para quem
pediu, com o comentário; card "SCs aguardando sua aprovação" na Home, só
quando houver alguma. O e-mail para `REQUESTS_STOCK_ALERT_TO` continua.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] Templates em `email_notification_templates`.
- [ ] Builders com testes (destinatário, link, comentário escapado, aprovador sem e-mail não envia).
- [ ] Card na Home.
