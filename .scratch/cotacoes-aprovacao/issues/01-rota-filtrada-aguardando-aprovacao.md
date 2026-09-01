# 01 — Rota filtrada de cotações "aguardando aprovação"

**What to build:** a lista de cotações passa a aceitar um parâmetro de
rota/query que já chega com o filtro de status "aguardando aprovação"
aplicado ao carregar a página — sem precisar que o usuário aplique o filtro
manualmente. O link usado no e-mail de notificação de submissão já existente
(hoje fixo na lista geral de cotações) passa a apontar para essa URL
filtrada, para o gestor já cair direto no que precisa aprovar.

**Blocked by:** None — can start immediately

**Status:** done

- [x] Acessar a lista de cotações com o parâmetro de filtro na URL mostra
      somente cotações em "aguardando aprovação", já aplicado ao carregar
- [x] A URL/contrato de rota é reaproveitável por outros pontos de entrada
      (card da Home, e-mails) — não é um deep-link por id individual
- [x] O e-mail de notificação de submissão já existente (disparado quando
      uma cotação entra em "aguardando aprovação") passa a linkar para essa
      lista filtrada em vez da lista geral
- [x] Navegar para a lista sem o parâmetro continua funcionando normalmente
      (sem filtro pré-aplicado, comportamento atual preservado)

## Comments

Já implementado no commit `6b4e547` ("feat(quotations): rota filtrada de
'aguardando aprovação' na lista"), antes desta sessão. Contrato reaproveitável
em `src/modules/quotations/routes.ts` (`QUOTATIONS_PATH`,
`QUOTATIONS_STATUS_QUERY_PARAM`, `buildQuotationsUrl(baseUrl, status?)`).
`QuotationManagementPage.tsx` lê `?status=` via `useSearchParams()` num
`useEffect` que roda só no mount — sem o parâmetro (ou com valor inválido),
não faz nada, preservando o comportamento atual.

Os três pontos de entrada usam o mesmo contrato, confirmado nesta sessão:
- Card da Home (`Home.tsx`) — `buildQuotationsUrl('', 'awaiting_approval')`
- E-mail de notificação de submissão (`notifications.ts`,
  `buildQuotationApprovalNotifications`) — `action_url:
  buildQuotationsUrl(APP_BASE_URL, 'awaiting_approval')`, coberto por
  `notifications.test.ts` (8/8 passando)
- E-mail diário de cotações pendentes
  (`tools/quotation-approval-digest/send-digest.ts`) — mesma função,
  `buildQuotationsUrl(appUrl, 'awaiting_approval')`, sem link hardcoded

Nenhum código novo foi escrito nesta sessão — só verificação e atualização
do tracker.
