# 03 — Resumo diário de solicitações por e-mail para a Louise

**What to build:** um Vercel Cron às 17h (BRT) monta o resumo das
solicitações (SC e SM) e envia por e-mail para `REQUESTS_DIGEST_EMAIL`. Sem
nada novo nem pendente, nada é enviado. Roda como handler
`requests-digest-cron` no dispatcher `api/notifications/[action].ts` criado
na issue 01. Nesta etapa o e-mail é o canal principal; a issue 04 adiciona o
WhatsApp na frente e transforma este e-mail em fallback, sem refazer nada
daqui.

**Blocked by:** 01, 02

**Status:** done

- [x] `vercel.json` ganha o cron `{ "path":
      "/api/notifications/requests-digest-cron", "schedule": "0 20 * * *" }`
      (20h UTC = 17h BRT, todo dia)
- [x] O handler exige `Authorization: Bearer <CRON_SECRET>` (401 sem ele),
      no padrão de `api/_lib/handlers/umami-inatividade-cron.ts`
- [x] Janela sem estado, calculada a partir do momento da execução: "novas" =
      `created_at` nas últimas 24h; "pendentes antigas" = `status =
      'pending'` e `created_at` anterior à janela (só a contagem)
- [x] Nada novo e nenhuma pendente → não envia nada e responde 200 com o
      motivo
- [x] `REQUESTS_DIGEST_EMAIL` ausente → erro logado, resposta 500, nada
      enviado
- [x] Migration nova cria o template `purchase_requests_daily_digest` em
      `notification_templates`, visual no padrão de
      `quotation_pending_approval_digest`, com:
      - título com a data do resumo
      - contagens: novas, SC, SM, urgentes, pendentes antigas
      - lista completa das novas (tipo · solicitante · departamento · qtd. de
        itens · "URGENTE" quando `priority !== 'standard'`)
      - botão "Ver pendentes" → `buildRequestsUrl(appUrl, 'pending')`
      - bloco de aviso opcional no topo (variável vazia nesta etapa; a issue
        04 preenche com "enviado por e-mail porque o WhatsApp falhou")
- [x] Montagem do resumo em função pura (seleção das novas, contagens,
      variáveis do e-mail), com as contagens expostas de forma
      reaproveitável pela issue 04
- [x] Testes vitest da função pura: limites da janela de 24h, separação
      novas × pendentes antigas, contagens por tipo e urgência, resumo vazio,
      escape de HTML em campos livres
- [ ] Validação manual: 401 sem `CRON_SECRET`; disparo real pela Vercel;
      e-mail recebido

## Comments

Env nova na Vercel (fora do repo — avisar o usuário): `REQUESTS_DIGEST_EMAIL`
— o mesmo e-mail em que a Louise recebe o resumo de cotações. `CRON_SECRET`
já existe.

14/10/2026 — conferido no código: implementado (o status estava desatualizado).
