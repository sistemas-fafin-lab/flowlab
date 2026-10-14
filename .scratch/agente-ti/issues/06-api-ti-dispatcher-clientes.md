# 06 — `api/ti`: dispatcher, Granola e IA com reserva

**What to build:** a base do lado do servidor, sem regra de negócio ainda.
- O dispatcher `api/ti/[action].ts` é a 10ª function do projeto e fica registrado nos três lugares.
- O cliente do Granola lista as notas de uma pasta a partir de uma data e busca uma nota.
- A IA tem **uma porta de entrada só**, `gerarEstruturado`:
  - tenta o **Claude Sonnet 5.5** (D2) e, se ele falhar ou estiver indisponível, o **Gemini 3.8 Flash** (D17);
  - usa o mesmo JSON Schema nos dois e valida a resposta com o mesmo zod;
  - grava cada tentativa em `ti_agente_chamadas_ia`.

Os clientes recebem `fetch` ou o cliente injetado e **nunca lançam exceção**: devolvem `{ ok, dados | erro }`, no padrão de `api/_lib/requestsDigestWhatsApp.ts`.

Nesta issue também se confirma, no primeiro preview da Vercel, que um handler em `api/` consegue importar `src/modules/eva/domain/*`. Se não conseguir, o domínio vai para `api/_lib/ti-agente/domain/` e o front passa a importar de lá (§8).

Plano: §3 (Granola, Claude e Gemini), §5, §8 (`api/`), §9.1 e RNF02/RNF03/RNF05.

**Blocked by:** 05 (precisa de `ti_agente_chamadas_ia`).

**Status:** done no código (13/Out/2026)

- [ ] `api/ti/[action].ts` espelhando `api/notifications/[action].ts`, com um `ROTAS` inicial contendo a ação `agente-sync-cron`, que exige `CRON_SECRET` e, nesta fase, só lista as notas em `dryRun`.
- [ ] Rota registrada no `api/server.ts` (`HANDLERS.set`) e no middleware de dev do `vite.config.ts`.
- [ ] `vercel.json`: `functions` com `maxDuration` de 300 s para `api/ti/[action].ts`. Conferir o máximo permitido no plano atual e registrar o valor na issue.
- [ ] `package.json`:
  - adicionar `@anthropic-ai/sdk` e `zod` 4. Hoje só existe o zod 3.22, indireto, sem `z.toJSONSchema`;
  - conferir que a troca não quebra quem usa o 3.22.
- [ ] `api/_lib/ti-agente/granola.ts`:
  - `listarNotas({ folderId, updatedAfter })`, com paginação por `cursor`;
  - `buscarNota(id)`, com `summary_markdown`, `web_url`, `attendees`, `calendar_event` e `updated_at`;
  - tratamento de 401, 429 (respeitar o limite de 25 por 5 s) e tempo esgotado.
- [ ] `api/_lib/ti-agente/ia/claude.ts`:
  - cliente com `apiKey: process.env.CLAUDE_API_KEY`, `timeout: 90_000` e `maxRetries: 1`;
  - `defaultHeaders: { 'anthropic-workspace-id': process.env.CLAUDE_WORKSPACE_ID }`, só quando a variável existe. A chave é da organização e sem o cabeçalho volta 400 (plano §3);
  - modelo **fixo** `claude-sonnet-5-5`, numa constante, sem variável de ambiente;
  - `messages.create` com `max_tokens: 16000` e `output_config: { effort, format: { type: 'json_schema', schema } }`;
  - sem o parâmetro `thinking`, porque `disabled` dá 400 no Sonnet 5.5, e sem o fallback de recusa do servidor da Anthropic, que trocaria de modelo Claude;
  - devolve o texto, `stop_reason` e o uso. Erros pelas classes tipadas do SDK, classificados em `erro` ou `configuracao` (400/401/403).
- [ ] `api/_lib/ti-agente/ia/gemini.ts`:
  - `@google/genai` no molde de `api/_lib/apoio/gemini.ts`;
  - `generateContent` com `config: { systemInstruction, responseMimeType: 'application/json', responseJsonSchema }`, tempo limite de 60 s;
  - modelo de `AGENTE_TI_GEMINI_MODEL`, com padrão `gemini-3.8-flash`;
  - limpa cerca de markdown antes do `JSON.parse`;
  - tokens tirados de `usageMetadata`.
- [ ] `api/_lib/ti-agente/ia/gerarEstruturado.ts`:
  - recebe `{ finalidade, instrucoes, conteudo, schemaZod, esforco, reuniaoId?, mensagemId? }` e gera o JSON Schema uma vez com `z.toJSONSchema`;
  - tenta o Claude e cai no Gemini nos casos da §9.1;
  - `safeParse` nos dois;
  - grava uma linha por tentativa em `ti_agente_chamadas_ia`, sem texto da reunião;
  - devolve `{ ok, dados, provedor, motivoReserva }` ou `{ ok: false, erros: [claude, gemini] }`.
- [ ] Testes:
  - `granola.ts` com `fetch` injetado: sucesso, paginação, 401, 429, JSON inválido;
  - `gerarEstruturado.test.ts` com clientes falsos, cobrindo todos os casos da §14.4 do plano, menos o aviso no sino (fica na 08).
- [ ] Confirmação do import de `src/modules/eva/domain/` no preview, registrada nos comentários.

## Comments

**13/Out/2026 — implementado.**
- **Dispatcher** `api/ti/[action].ts` (10ª function), registrado também em `api/server.ts` e no `tiApiPlugin` do `vite.config.ts`. No `vercel.json`:
  - `functions` com `"api/ti/*.ts"` e `maxDuration` 300 (o padrão `[action]` seria lido como classe de caracteres de glob);
  - cron `0 12 * * 1-5`.
- **IA:**
  - `api/_lib/ti-agente/ia/` com `tipos.ts`, `claude.ts` (Sonnet 5.5 fixo, cabeçalho do workspace, 90 s e 1 nova tentativa, cache no último bloco do system), `gemini.ts` (3.8 Flash, 90 s) e `gerarEstruturado.ts`;
  - JSON Schema único gerado pelo `z.toJSONSchema` do zod 4, sem `$schema`.
- **Granola:** `granola.ts`, com paginação por cursor e erros legíveis.
- **Dependências:** `@anthropic-ai/sdk` 0.133 e `zod` 4.6. O zod 3.22 segue aninhado só em `@vercel/python-analysis`.
- **Import de `src/` (resolvido sem preview):** `api/` compila com NodeNext e exige `.js` nos imports, então não importa o domínio de `src/`. A extração ficou autocontida em `api/_lib/ti-agente/`. A cobrança (14) volta a esta questão.
- **Testes:** 31 no servidor (IA, Granola, extração).

**Teste real (13/Out, sem gravar nada):** Granola, Claude e Gemini reais, contexto lido do Supabase só com SELECT. Os dois provedores aceitaram o schema. O Gemini estourou 60 s numa das rodadas, e o limite dele subiu para 90 s.
