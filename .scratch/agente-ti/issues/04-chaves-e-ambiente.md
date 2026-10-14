# 04 — Chaves e ambiente (humano)

**What to build:** os passos fora do código para a Fase 2 rodar de verdade. O teste de 13/Out mostrou dois pontos:
- a chave do Claude é da organização, então cada chamada precisa do cabeçalho `anthropic-workspace-id`. Já resolvido no `.env` (ver Comments);
- a chave do Granola só enxerga uma nota. É a única que existe, e a chave fica como está.

Plano: §3 e §16.

**Blocked by:** nenhuma; pode ser feita a qualquer momento antes da 08.

**Status:** ready-for-human

- [x] **Claude, local:** `CLAUDE_WORKSPACE_ID` no `.env`, ao lado de `CLAUDE_API_KEY` (chave da organização). Testado com HTTP 200.
- [ ] **Claude, Vercel:** cadastrar `CLAUDE_API_KEY` e `CLAUDE_WORKSPACE_ID` (Production e Preview).
- [x] **Claude, decidido (13/Out):** a chave da organização não muda, nem em produção. O usuário é o dono da organização.
- [ ] **Claude, opcional:** se o workspace não for o Default, definir nele um limite de gasto mensal.
- [ ] **Gemini, Vercel:** confirmar que `GEMINI_API_KEY` já está cadastrada (o Apoio Alvaro usa) em Production e Preview. `AGENTE_TI_GEMINI_MODEL` é opcional; o padrão no código é `gemini-3.8-flash`.
- [x] **Granola, decidido (13/Out):** fica a chave atual (conta "Tecnologia e AI"), porque só existe essa nota mesmo. Se outras contas passarem a gravar reuniões, trocar por uma chave de workspace (plano §3).
- [ ] **Granola, Vercel:** cadastrar `GRANOLA_API_KEY`.
- [ ] **WhatsApp, Vercel (14/Out):** cadastrar `WAHA_WEBHOOK_SECRET`, um valor aleatório longo (ex.: `openssl rand -hex 32`). É o mesmo token que vai na URL do webhook no WAHA (issue 13). `WAHA_SESSION` é opcional (padrão `eva`, o nome da sessão criada).
- [x] **Primeiro deploy (14/Out):** conferir que as rotas `/api/ti/*` respondem. ✅ No preview, `/api/ti/agente-sync-cron` sem token devolveu o `401` em JSON esperado. É a primeira vez que uma function da Vercel importa código de `src/` (o domínio da EVA); localmente funciona, mas o empacotamento da Vercel só se confirma no deploy.
- [ ] Combinar com a equipe que as reuniões de TI vão para a pasta **"Team meetings"** do espaço "TI Lab team". É essa pasta que o agente lê.
- [ ] Remover `VITE_WAHA_API_URL`, `VITE_WAHA_SESSION_NAME` e `VITE_WAHA_API_KEY` do `.env`. Não são usadas, e o prefixo `VITE_` vazaria a chave para o navegador se algum dia fossem lidas.
- [ ] Depois da 06: chamar `GET /api/ti/agente-sync-cron?dryRun=true` com o `CRON_SECRET` e confirmar que lista as notas da pasta.

## Comments

**13/Out/2026, chave do Claude.**
- Sem o cabeçalho: HTTP 400 ("not scoped to a workspace").
- O usuário confirmou que a chave é da organização. É uma chave multi-workspace, que roda no workspace indicado por `anthropic-workspace-id`.
- Listar workspaces com ela deu 403 ("Missing permissions"). O usuário é o dono da organização, então a causa provável é o escopo da chave, sem administração. O agente não precisa disso. O ID veio do Console.
- Com `CLAUDE_WORKSPACE_ID` no `.env`: `GET /v1/models` responde HTTP 200, o workspace da resposta é o enviado, e `claude-sonnet-5-5` (D2) está disponível. Nenhum token gasto.

**13/Out/2026, Gemini (reserva, D17).** `GET /v1beta/models/gemini-3.8-flash` com a `GEMINI_API_KEY` do `.env`: HTTP 200, suporta `generateContent`. Nenhum token gasto.
