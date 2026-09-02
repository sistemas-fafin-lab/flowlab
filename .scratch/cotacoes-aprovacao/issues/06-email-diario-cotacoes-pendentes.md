# 06 — E-mail diário de cotações pendentes (17h)

**What to build:** um script que roda uma vez por dia, às 17h, e envia um
e-mail individual para cada gestor com alçada de aprovação, listando só as
cotações que ainda estão "aguardando aprovação" com ele. Reaproveita a mesma
consulta de elegibilidade (gestor × alçada × valor) e a mesma função de
construção de notificação já usadas hoje na notificação de submissão, e
envia através do endpoint de notificação por e-mail já existente no
projeto. Os links do e-mail apontam para a lista de cotações filtrada
(ticket 01). O agendamento segue o mesmo mecanismo de cron do sistema
operacional já usado para o alerta de hardware existente no projeto, mas a
lógica de elegibilidade/montagem da notificação é implementada na mesma
linguagem/runtime do domínio de cotações — não é reescrita em outra
linguagem.

**Blocked by:** 01

**Status:** done

- [x] Rodando o script, cada gestor elegível (com alçada e pelo menos uma
      cotação pendente com ele) recebe um e-mail individual listando só as
      cotações que ainda estão "aguardando aprovação" com ele
- [x] Gestor sem nenhuma cotação pendente não recebe e-mail
- [x] A lógica de elegibilidade reaproveita a mesma consulta/função já usada
      pela notificação de submissão existente — não duplica a regra de
      negócio
- [x] O e-mail é enviado através do endpoint de notificação por e-mail já
      existente no projeto
- [x] Os links no corpo do e-mail apontam para a lista de cotações filtrada
      por "aguardando aprovação" (ticket 01)
- [x] O script pode ser agendado via cron do sistema operacional, no mesmo
      padrão já usado pelo alerta de hardware existente no projeto (horário:
      17h)
- [x] Teste unitário cobre a função que agrupa cotações pendentes por gestor
      e monta as notificações (múltiplos gestores, gestor sem pendências,
      mais de uma cotação pendente para o mesmo gestor)

## Comments

Implementado em `tools/quotation-approval-digest/`. A função pura
`buildPendingApprovalDigestNotifications`
(`src/modules/quotations/pendingApprovalDigest.ts`) agrupa as cotações
pendentes por gestor elegível, reaproveitando a mesma view de elegibilidade
(`user_approval_limits_with_details`, `can_approve = true`) e a mesma regra
de "valor real" (`getQuotationAmountFromRow`, já usada pela decisão de
aprovação/rejeição no servidor) — testada em `pendingApprovalDigest.test.ts`.
O `escapeHtml` usado por essa função e por `notifications.ts` foi extraído
para `src/modules/quotations/utils/escapeHtml.ts` para não duplicar.
`send-digest.ts` roda no mesmo runtime TS/Node do domínio (não em Python),
busca cotações `awaiting_approval` e gestores elegíveis via Supabase, e
envia cada notificação via `POST /api/notifications/email` — mesmo endpoint
já usado hoje. `install.sh` cria um systemd timer às 17h, mesmo mecanismo do
alerta de hardware (`tools/hardware-monitor/`), mas — diferente dele — roda
a partir de um checkout do próprio repositório (`REPO_DIR`), já que depende
do código-fonte do domínio de cotações. Novo template de email
`quotation_pending_approval_digest`
(`supabase/migrations/20260902130000_quotation_pending_approval_digest_template.sql`).
