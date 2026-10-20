# 04 — E-mails e card na Home

**What to build:** e-mail "SC aguardando sua aprovação" ao aprovador quando
a SC recebe `approver_id` (criação, backfill não dispara, recálculo da issue 03
dispara), com link para a lista filtrada; e-mail de rejeição para quem
pediu, com o comentário; card "SCs aguardando sua aprovação" na Home, só
quando houver alguma. O e-mail para `REQUESTS_STOCK_ALERT_TO` continua.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] Templates em `email_notification_templates`.
- [ ] Builders com testes (destinatário, link, comentário escapado, aprovador sem e-mail não envia).
- [ ] Card na Home.

## Comments

**20/10/2026 — sinal do recálculo (issue 03).** Os triggers da 03
(`requests_recalcular_aprovador_colaborador` e `_departamento`, em
`20261020234000_sc_recalculo_aprovador.sql`) gravam `approver_id` dentro do
save do RH e não deixam rastro de quais SCs receberam aprovador. Para
disparar o e-mail daqui é preciso um sinal: p.ex. fila/outbox gravada pelos
próprios triggers, ou `approver_assigned_at` em `requests`. O trigger do
colaborador só age quando `departamento_id` muda de fato (re-salvar a ficha
não recalcula).
