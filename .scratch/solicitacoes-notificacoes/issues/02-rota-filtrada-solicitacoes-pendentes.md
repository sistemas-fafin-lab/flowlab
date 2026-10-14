# 02 — Rota filtrada de solicitações pendentes

**What to build:** a tela de solicitações (`/requests/purchases`,
`RequestManagement.tsx`) passa a aceitar `?status=` na URL e já abre com o
filtro de status aplicado. Um contrato de URL reaproveitável
(`buildRequestsUrl(baseUrl, status?)`) espelha
`src/modules/quotations/routes.ts` e passa a ser usado nos links das
notificações.

**Blocked by:** None — can start immediately

**Status:** done

- [x] Novo módulo de rotas com `REQUESTS_PURCHASES_PATH`,
      `REQUESTS_STATUS_QUERY_PARAM` e `buildRequestsUrl(baseUrl, status?)`,
      importável tanto pelo SPA quanto por `api/_lib/`
- [x] Acessar `/requests/purchases?status=pending` mostra só as pendentes,
      com o filtro já aplicado ao carregar (usando o filtro de status que a
      tela já tem)
- [x] Sem o parâmetro, ou com valor inválido, a tela se comporta como hoje
- [x] Se a issue 01 já estiver pronta, o botão do e-mail do estoque passa a
      usar `buildRequestsUrl(appUrl, 'pending')`
- [x] Teste vitest de `buildRequestsUrl` com e sem status
