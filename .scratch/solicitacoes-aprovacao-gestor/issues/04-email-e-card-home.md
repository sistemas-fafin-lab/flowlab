# 04 — E-mails e card na Home

**What to build:** e-mail "SC aguardando sua aprovação" ao aprovador quando
a SC recebe `approver_id` (criação, backfill não dispara, recálculo da issue 03
dispara), com link para a lista filtrada; e-mail de rejeição para quem
pediu, com o comentário; card "SCs aguardando sua aprovação" na Home, só
quando houver alguma. O e-mail para `REQUESTS_STOCK_ALERT_TO` continua.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [x] Templates em `notification_templates` (a tabela real; `email_notification_templates` não existe).
- [x] Builders com testes (destinatário, link, comentário escapado, aprovador sem e-mail não envia).
- [x] Card na Home.
- [ ] Provisionar no Vault de cada ambiente `flowlab_sc_aviso_aprovador_url` e `flowlab_cron_secret` e validar no projeto de teste (criação da SC e recálculo da 03 avisam o aprovador; rejeição avisa quem pediu).

## Comments

**20/10/2026 — sinal do recálculo (issue 03).** Os triggers da 03
(`requests_recalcular_aprovador_colaborador` e `_departamento`, em
`20261020234000_sc_recalculo_aprovador.sql`) gravam `approver_id` dentro do
save do RH e não deixam rastro de quais SCs receberam aprovador. Para
disparar o e-mail daqui é preciso um sinal: p.ex. fila/outbox gravada pelos
próprios triggers, ou `approver_assigned_at` em `requests`. O trigger do
colaborador só age quando `departamento_id` muda de fato (re-salvar a ficha
não recalcula).

**20/10/2026 — implementação.**

- Sinal: `requests.approver_notified_at` (migration
  `20261020235000_sc_aviso_ao_aprovador.sql`). SC `pending` com `approver_id`
  e `approver_notified_at` nulo = aviso na fila. Cobre criação e os dois
  triggers da 03 sem alterá-los. O backfill da 01 entra marcado (não avisa).
  O client não grava a coluna (zerada no INSERT, UPDATE barrado). Se
  `approver_id` muda (p.ex. volta a NULL por `ON DELETE SET NULL` e o
  recálculo atribui outro), a marca é zerada e o novo aprovador é avisado.
- Disparo: trigger `requests_avisar_aprovador` (`AFTER INSERT OR UPDATE OF
  approver_id`, por statement) chama via pg_net, se houver fila,
  `POST /api/notifications/sc-awaiting-approval` com `Bearer CRON_SECRET`
  (segredos no Vault, padrão da integração LAB-HUB). A rota esvazia a fila:
  marca cada SC antes de enviar (sem duplicar entre chamadas simultâneas),
  desmarca se o envio falhar, aprovador sem e-mail fica marcado sem envio.
  Chamada perdida é recuperada pela próxima.
- Rejeição: o SPA chama `POST /api/notifications/sc-rejected` `{ id }` depois
  da RPC; só quem rejeitou (`rejected_by_user_id`) dispara.
- Templates `purchase_request_awaiting_approval` (link `?aprovacao=minha`) e
  `purchase_request_rejected` (motivo, link `?status=rejected`) em
  `20261020235100_sc_aprovacao_email_templates.sql`. Builders puros em
  `api/_lib/scApprovalEmails.ts`.
- Home: card "SCs aguardando sua aprovação" (`sc-approvals`), só com
  pendência, para qualquer usuário logado.
- O e-mail de SC criada para `REQUESTS_STOCK_ALERT_TO` não mudou.
- Fora: varredura periódica da fila (falha de envio só é retentada no
  próximo INSERT/troca de aprovador) e aviso perdido se a função cair entre
  marcar e enviar — aceitos como melhor esforço.
- Validado num Postgres 18 local com pg_net/Vault simulados: backfill marca
  sem chamar; sem segredos → WARNING e fica na fila; com segredos, uma chamada
  por statement com o Bearer; INSERT do client zera a coluna; client não
  marca; fila vazia não chama.

**21/10/2026 — Vault de produção (jqx).** `flowlab_sc_aviso_aprovador_url` =
`https://flow-lab.vercel.app/api/notifications/sc-awaiting-approval` e
`flowlab_cron_secret` = `CRON_SECRET` de produção da Vercel (conferido por
hash; o `.env` local tinha um valor antigo, diferente). Fila vazia na hora, sem
envio real ainda. Falta: o Vault do projeto de teste e ver o primeiro aviso
sair em produção (criação de SC, recálculo, rejeição).
