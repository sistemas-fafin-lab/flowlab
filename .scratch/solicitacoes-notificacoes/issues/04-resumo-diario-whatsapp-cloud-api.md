# 04 — Resumo diário por WhatsApp (Cloud API da Meta), com e-mail de fallback

**What to build:** o cron da issue 03 passa a tentar primeiro o WhatsApp,
enviando o template aprovado `resumo_solicitacoes_diario` pela Cloud API da
Meta para a Louise. Se o WhatsApp falhar por qualquer motivo, o e-mail da
issue 03 é enviado com o aviso de falha preenchido. Com o WhatsApp
funcionando, o e-mail deixa de ser enviado nos dias em que o WhatsApp dá
certo.

**Blocked by:** 03

**Status:** needs-info

Falta definir o remetente: o número de final **4986** (o 6097 do antigo
`hub-whatsapp` foi descartado). É preciso descobrir em qual conta do
WhatsApp (WABA) e app da Meta ele está e ter um token de System User com
acesso a ela. Quando isso estiver resolvido, mudar para `ready-for-agent`.

- [x] Envio pela Graph API: `POST
      https://graph.facebook.com/v25.0/{WHATSAPP_PHONE_NUMBER_ID}/messages`
      com `Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}`, `type:
      "template"`, template `resumo_solicitacoes_diario`, idioma `pt_BR` e 6
      parâmetros de corpo na ordem: data, novas, SC, SM, urgentes, pendentes
      antigas (reaproveitando as contagens da função pura da issue 03). O
      botão tem URL fixa e não recebe parâmetro.
- [x] Destinatário em `REQUESTS_DIGEST_WHATSAPP_TO` (só dígitos, com DDI)
- [x] Qualquer falha (env ausente, status ≠ 2xx, template não aprovado,
      token inválido, falta de pagamento) → e-mail da issue 03 com o aviso
      preenchido; código e mensagem do erro da Graph API no log da Vercel
- [x] WhatsApp enviado com sucesso → o e-mail não é enviado
- [x] Resumo vazio continua não enviando nada, em nenhum canal
- [x] Função de envio com `fetch` injetado, testada com vitest: sucesso,
      status ≠ 2xx e env ausente sinalizam falha; parâmetros na ordem certa
- [ ] Validação manual: mensagem recebida no WhatsApp; com o token
      propositalmente errado, o e-mail chega com o aviso

## Comments

Pendências operacionais (fora do código — o usuário resolve):

- Descobrir a conta e o app do número 4986: em
  https://business.facebook.com/wa/manage/phone-numbers/ (trocando de conta
  no seletor do topo) ou em **WhatsApp → Configuração da API** de cada app em
  https://developers.facebook.com/apps.
- Gerar um token de System User só para o flowlab, com expiração "Nunca" e
  `whatsapp_business_messaging`, com a conta do 4986 atribuída.
- Conferir o app em modo Live e a forma de pagamento da conta do WhatsApp.
- Criar no WhatsApp Manager o template `resumo_solicitacoes_diario`
  (Utility, Português BR):

  > 📦 Resumo de solicitações de {{1}}: {{2}} novas nas últimas 24h ({{3}}
  > SC, {{4}} SM, {{5}} urgentes) e {{6}} ainda pendentes de dias
  > anteriores. Toque no botão abaixo para ver a lista.

  Botão de URL fixa "Ver pendentes" →
  `https://<app>/requests/purchases?status=pending`.
- Envs na Vercel: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`,
  `REQUESTS_DIGEST_WHATSAPP_TO`.
- O número é só para envio: respostas da Louise não são tratadas.

Código implementado (envio em `api/_lib/requestsDigestWhatsApp.ts`, fallback no
handler `api/_lib/handlers/notifications-requests-digest-cron.ts`). Até as envs
do WhatsApp existirem na Vercel, todo dia o WhatsApp falha por "Env ausente" e
o resumo segue por e-mail com o aviso — comportamento seguro para subir já.
`REQUESTS_DIGEST_EMAIL` passou a ser exigida só quando o fallback é usado.
Falta a validação manual, depois das pendências operacionais acima.

Limitação conhecida: só falhas síncronas caem para o e-mail (env ausente, HTTP ≠
2xx, erro de rede). A Cloud API pode aceitar a mensagem (200) e só depois marcá-la
como `failed` via webhook (ex.: pagamento, código 131042) — nesse caso não há
e-mail. Cobrir isso exigiria receber os webhooks de status; fora do escopo.
