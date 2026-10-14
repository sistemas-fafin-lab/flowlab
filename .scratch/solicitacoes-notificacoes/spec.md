# Solicitações (SC/SM): e-mail imediato para o estoque e resumo diário para a Louise

Status: ready-for-agent

## Problem Statement

Hoje, quando alguém cria uma Solicitação de Compra (SC) ou uma Solicitação de
Material (SM), ninguém é avisado. A pessoa responsável pelo estoque só fica
sabendo que há algo novo se entrar na tela de solicitações e conferir
manualmente. Já existiu um alerta por e-mail para SC com item sem estoque
(`8d43b29`), mas ele foi removido em `e1b1027` junto com a entrada da
notificação por alçada de cotações — e cobria só um caso específico, nunca
SM. Além disso, a Louise (que já recebe o resumo diário de cotações por
e-mail) não tem nenhuma visão consolidada do que está chegando em
solicitações. O objetivo final é que ela receba esse resumo por WhatsApp,
mas o número remetente ainda não está definido.

## Solution

Entrega em duas etapas:

1. **E-mail imediato para o estoque** — toda SC ou SM nova dispara, logo após
   ser criada, um e-mail para o(s) endereço(s) configurado(s) na env
   `REQUESTS_STOCK_ALERT_TO`, com os detalhes da solicitação e um botão para
   a lista de pendentes. Melhor esforço: falha no envio nunca bloqueia a
   criação.
2. **Resumo diário para a Louise** — um Vercel Cron às 17h (horário de
   Brasília) monta um resumo com as solicitações criadas nas últimas 24h e a
   contagem das que ainda estão pendentes de dias anteriores.
   - **Agora:** o resumo vai **por e-mail** para `REQUESTS_DIGEST_EMAIL`.
   - **Depois (issue 04, aguardando o número):** o WhatsApp via Cloud API da
     Meta passa a ser o canal principal, e o e-mail vira o fallback quando o
     WhatsApp falhar.

   Sem nada novo nem pendente, nada é enviado.

Os links das notificações abrem a tela de solicitações já filtrada por
"pendente" (`/requests/purchases?status=pending`), no mesmo contrato de URL
já usado em cotações (`src/modules/quotations/routes.ts`).

## User Stories

1. Como responsável pelo estoque, quero receber um e-mail assim que qualquer
   SC ou SM for criada, para não depender de conferir a tela manualmente.
2. Como responsável pelo estoque, quero que o e-mail traga tipo, solicitante,
   departamento, prioridade, justificativa e os itens com quantidade (e o
   fornecedor, quando for SC), para entender o pedido sem abrir o sistema.
3. Como responsável pelo estoque, quero que solicitações com prioridade
   `priority` ou `urgent` venham com "[URGENTE]" no assunto, para priorizar a
   leitura.
4. Como responsável pelo estoque, quero ver quais itens estão sem estoque no
   próprio e-mail, para já saber o que vai virar compra.
5. Como solicitante, quero que a criação da minha solicitação nunca falhe por
   causa de um problema no envio do e-mail.
6. Como responsável pelo estoque ou pela aprovação, quero que o botão/link
   das notificações abra a lista de solicitações já filtrada por "pendente".
7. Como Louise, quero receber uma vez por dia, às 17h, um resumo das
   solicitações novas das últimas 24h e quantas continuam pendentes de dias
   anteriores, para acompanhar o fluxo sem entrar no sistema.
8. Como Louise, quero que o resumo não venha quando não há nada novo nem
   pendente, para não receber mensagem vazia.
9. Como Louise, quero (na etapa 2) receber esse resumo no WhatsApp, e
   continuar recebendo por e-mail quando o WhatsApp falhar.
10. Como administrador, quero trocar os destinatários só mudando env na
    Vercel, sem deploy de código.
11. Como administrador, quero que o endpoint do cron só responda a chamadas
    autenticadas com `CRON_SECRET`.

## Implementation Decisions

- **Escopo:** SC e SM, toda solicitação nova (status `pending` na criação).
  Nada é disparado em aprovação, rejeição ou conclusão.
- **Limite de functions da Vercel (Hobby = 12):** hoje existem 10 arquivos
  de function em `api/`. Em vez de criar arquivos novos, `api/notifications/email.ts`
  vira o dispatcher `api/notifications/[action].ts` — mesmo padrão de
  `api/umami/[action].ts` — com os handlers em `api/_lib/handlers/`:
  `email` (comportamento atual, mesma URL `/api/notifications/email`),
  `request-created` e `requests-digest-cron`.
- **E-mail do estoque:**
  - Disparo no front, em `handleSubmitRequest` (`RequestManagement.tsx`),
    depois que `addRequest` retorna a linha criada: `POST
    /api/notifications/request-created` com `{ id }` e o JWT de sessão do
    usuário no `Authorization: Bearer` (mesmo contrato de sessão de
    `api/_lib/umamiAuth.ts`, mas sem exigir permissão específica — qualquer
    usuário logado pode criar solicitação). Fire-and-forget com try/catch.
  - O servidor lê a solicitação por `id` com o client admin, monta as
    variáveis e chama `sendTemplatedEmail` para cada endereço de
    `REQUESTS_STOCK_ALERT_TO` (lista separada por vírgula). O cliente nunca
    envia conteúdo nem destinatário.
  - Template novo `purchase_request_created` em `notification_templates`
    (nova migration), visual no padrão de `quotation_pending_approval_digest`.
  - "[URGENTE]" no assunto quando `priority !== 'standard'`.
  - Marcação "sem estoque" por item, recalculada no servidor a partir do
    estoque atual em `products` (a regra antiga `getOutOfStockItems` foi
    removida em `e1b1027` e pode servir de referência no histórico do git).
- **Filtro na URL:** `RequestManagement` lê `?status=` via
  `useSearchParams()` no mount e aplica o filtro de status existente. Novo
  módulo de contrato de URL (`REQUESTS_PURCHASES_PATH`,
  `buildRequestsUrl(baseUrl, status?)`), espelhando
  `src/modules/quotations/routes.ts`. Rota real: `/requests/purchases`.
- **Resumo diário (e-mail — issue 03):**
  - Vercel Cron em `vercel.json`: `{ "path":
    "/api/notifications/requests-digest-cron", "schedule": "0 20 * * *" }`
    (20h UTC = 17h BRT). Todo dia, inclusive fim de semana, igual ao resumo
    de cotações. No Hobby o disparo pode cair entre 17h00 e 17h59 — aceito.
  - Autorização `Authorization: Bearer <CRON_SECRET>`, mesmo padrão de
    `api/_lib/handlers/umami-inatividade-cron.ts`.
  - Janela fixa sem estado: "novas" = `created_at` em `[agora − 24h, agora)`,
    com `agora` = momento da execução; "ainda pendentes" = `status =
    'pending'` e `created_at < agora − 24h` (só a contagem).
  - Nada novo e nenhuma pendente → não envia nada (resposta 200 com o motivo).
  - E-mail para `REQUESTS_DIGEST_EMAIL` (mesmo e-mail em que a Louise recebe
    o resumo de cotações) via `sendTemplatedEmail`, template novo
    `purchase_requests_daily_digest`: lista completa das novas (tipo ·
    solicitante · departamento · qtd. de itens · "URGENTE"), contagens
    (novas, SC, SM, urgentes, pendentes antigas) e botão para
    `buildRequestsUrl(appUrl, 'pending')`. O template já prevê um aviso
    opcional no topo ("enviado por e-mail porque o WhatsApp falhou"), vazio
    nesta etapa.
  - A montagem do resumo (seleção das novas, contagens, variáveis do e-mail)
    é uma função pura separada do handler, e expõe as contagens de forma
    reaproveitável pela etapa do WhatsApp.
- **Resumo diário (WhatsApp — issue 04, bloqueada):**
  - Canal: WhatsApp Cloud API da Meta (não WAHA), com o número de final
    4986 — ainda falta descobrir em qual conta do WhatsApp (WABA) e app ele
    está e gerar um token de System User com acesso a ela. O número 6097 do
    antigo `hub-whatsapp` foi descartado.
  - Template `resumo_solicitacoes_diario`, categoria Utility, `pt_BR`,
    criado à mão no WhatsApp Manager:
    > 📦 Resumo de solicitações de {{1}}: {{2}} novas nas últimas 24h ({{3}}
    > SC, {{4}} SM, {{5}} urgentes) e {{6}} ainda pendentes de dias
    > anteriores. Toque no botão abaixo para ver a lista.

    Botão de URL fixa "Ver pendentes" →
    `https://<app>/requests/purchases?status=pending`.
  - Qualquer falha da Graph API (template não aprovado, token inválido, sem
    pagamento, env ausente) → resumo por e-mail com o aviso preenchido, e
    código/mensagem do erro no log da Vercel.
- **Envs novas (Vercel):**
  - Issue 01: `REQUESTS_STOCK_ALERT_TO` — e-mail(s) do estoque, separados
    por vírgula.
  - Issue 03: `REQUESTS_DIGEST_EMAIL` — e-mail da Louise.
  - Issue 04: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`,
    `REQUESTS_DIGEST_WHATSAPP_TO`.
  - Reusa `CRON_SECRET` e as envs SMTP/Supabase já existentes.

## Testing Decisions

- Vitest em funções puras, no padrão de `pendingApprovalDigest.test.ts` e
  `notifications.test.ts` — sem mock profundo de Supabase e sem testes de
  componente.
- Montagem do e-mail do estoque: SC com fornecedor, SM sem fornecedor,
  prioridade `standard` vs `urgent` (assunto), item sem estoque marcado,
  escape de HTML em campos livres (justificativa, nome de item).
- Contrato de URL: `buildRequestsUrl` com e sem status.
- Resumo diário: janela de 24h (limites incluídos/excluídos), separação entre
  novas e pendentes antigas, contagens por tipo e urgência, resumo vazio →
  nada a enviar, variáveis do e-mail.
- Issue 04: função de envio pela Graph API com `fetch` injetado — sucesso,
  status ≠ 2xx e env ausente sinalizam falha para o fallback; parâmetros do
  template na ordem certa.
- Validação manual: cron na Vercel (disparo real e 401 sem `CRON_SECRET`),
  recebimento real dos e-mails e, na issue 04, da mensagem no WhatsApp.

## Out of Scope

- Notificar mudanças de status (aprovação, rejeição, conclusão).
- Enviar WhatsApp para o estoque ou e-mail diário para o estoque.
- Guardar histórico dos resumos enviados ou reenviar resumos que falharam.
- Configurar destinatários pela interface (fica em env).
- Usar WAHA ou o número do antigo `hub-whatsapp`.
- Mexer no módulo `src/modules/messaging/` do frontend (continua como está,
  para fornecedores).
