# 13 — WAHA na VPS (humano)

**What to build:** os passos de infraestrutura para o número do agente funcionar.

O WAHA Plus roda na VPS em `127.0.0.1:3000`. O usuário o acessa por um **endpoint ngrok** na própria VPS, e é por ele que vai configurar a sessão (13/Out). O agente não usa o ngrok: o script da fila (12) fala com o WAHA pelo `localhost` da mesma máquina (D9). Como o túnel deixa a API do WAHA acessível pela internet, o endpoint precisa estar protegido antes de conectar o número.

Plano: §2 (D9), §3 (WAHA), §11 e §16.

**Blocked by:** nenhuma para criar e proteger a sessão, que pode ser feita já. A 12 só é necessária para instalar o timer e para o "Enviar teste".

**Status:** ready-for-human

- [x] **Proteger o endpoint ngrok** antes de conectar o número:
  - chave de API ligada no WAHA, exigida em toda chamada (`X-Api-Key`);
  - senha no painel e no Swagger do WAHA;
  - de preferência, autenticação no próprio ngrok (Basic Auth ou OAuth na política de tráfego) ou restrição de IP.
- [x] Testar que uma chamada sem a chave, pela URL do ngrok, é recusada (ex.: `GET <url-ngrok>/api/sessions` sem `X-Api-Key` deve voltar 401).
- [x] Criar no WAHA a sessão **`eva`** (criada em 14/Out com outro nome que o planejado; o código usa `eva` por padrão) e conectar o número **+55 61 9992-4986** (o número do próprio agente) pelo QR code. A sessão `quotations_001` fica como está.
- [ ] Configurar o webhook da sessão para `https://<app>/api/ti/waha-webhook?token=<WAHA_WEBHOOK_SECRET>`, com os eventos `message` e `message.ack` (este último, para os selos Entregue/Lida do Início). Sem HMAC: a 15 decidiu pelo token na URL. Gere um valor aleatório longo (ex.: `openssl rand -hex 32`) e cadastre o mesmo em `WAHA_WEBHOOK_SECRET` na Vercel. A cobrança (14) não depende deste item.
- [ ] Na VPS, definir para o script:
  - `WAHA_URL=http://127.0.0.1:3000` (o `localhost`, **não** a URL do ngrok);
  - `WAHA_API_KEY`, `WAHA_SESSION=eva`;
  - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do projeto **do app** (o do `VITE_SUPABASE_URL`), não o de teste.
  
  Todas sem prefixo `VITE_`. O `install.sh` grava essas variáveis em `/etc/flowlab/eva-whatsapp.env` (600).
- [ ] Depois da 12: rodar `tools/agente-ti-whatsapp/install.sh` e conferir o timer (`systemctl list-timers`).
- [ ] Depois da 12: cadastrar pelo menos um membro com WhatsApp, ligar o WhatsApp em Configurações e usar **"Enviar teste"**. A mensagem precisa chegar no celular.

## Comments

**14/Out/2026 — sessão criada e endpoint conferido.**
- **Sessão:** chama-se **`eva`** (não `ti_agente`, como planejado). O código passou a usar `eva` por padrão no script da VPS, no instalador e no webhook, e `WAHA_SESSION` só é preciso se o nome mudar.
  - Situação: `WORKING`, número `556199924986@c.us` (sem o 9º dígito), engine **GOWS**.
  - Ainda sem webhooks configurados.
- **Ajustes no código por causa do GOWS:**
  - o leitor de número ignora o sufixo de aparelho (`556199924986:1@s.whatsapp.net`);
  - o webhook procura o número do remetente também em `_data.Info.SenderAlt`/`ChatAlt`, para quando ele vier como LID (`…@lid`).
- **Proteção do ngrok:** `GET https://waha.ngrok.dev/api/sessions`, `/api/sessions/eva` e `/dashboard` sem chave voltaram **401**.

**13/Out/2026.** O usuário confirmou que +55 61 9992-4986 é o número do agente e que a sessão será configurada pelo endpoint ngrok da VPS. O item antigo, "conferir que a porta 3000 continua só em `127.0.0.1`", deixou de bastar: a porta pode continuar local, mas o túnel a expõe. Por isso entraram os dois primeiros itens.
