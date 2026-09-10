# 02 — Endpoint de leitura para a Tabela Particular

**What to build:** endpoint HTTP novo, só-leitura, em `api/` (mesma área de
serverless functions usada por `api/analises-clinicas/deliver-coleta.ts` e
`api/_lib/labhubIntegration.ts` para a integração com o LAB-HUB — reaproveitar
esse mesmo padrão de "app externo chama com uma API key dedicada").

- Rota sugerida: `api/integracoes/orcamento-particular.ts` (nome exato fica a
  critério de quem implementar, mantendo o padrão de nomeação já usado em
  `api/analises-clinicas/`).
- Autenticação: header `Authorization: Bearer <chave>`, validado contra uma
  env var nova e dedicada — `TABELA_PARTICULAR_API_KEY` — **não** reaproveitar
  `FLOWLAB_API_KEY` (blast radius separado do LAB-HUB; revogar uma não afeta
  a outra).
- Resposta: JSON com um item por TUSS que tenha preço "Particular" cadastrado,
  contendo:
  - `tuss`
  - `nome` (de `custo_exames.nome`, join por `tuss`)
  - `preco` (`custo_fontes_pagadoras.valor` onde `fonte_pagadora='Particular'`)
  - `custo` (`custo_exames.custo_direto + custo_exames.custo_indireto` — soma
    completa, mais fiel ao modelo de custo do flowlab do que só
    `custo_direto`)
  - `elegivelDescontoParticular` (`custo_fontes_pagadoras.elegivel_desconto_particular`
    da linha Particular — depende da migration 01)
  - `conveniosAceitos`: lista de `fonte_pagadora` distintos (excluindo
    `'Particular'`) que têm alguma linha com esse `tuss` e `atendido = true`
    — só os nomes, sem valor (não expõe preço negociado de convênio pra fora
    do flowlab)
- Query: consulta direto o Postgres via client admin (mesmo padrão de
  `getSupabaseAdminClient()` usado em `api/_lib/supabase.ts` e no script
  `migrar-orcamento-particular.ts`) — bypassa RLS porque é o próprio backend
  do flowlab chamando, autenticado pela API key, não pelo usuário final.
- Sem paginação: retorna a lista inteira num payload só, mesmo padrão que a
  Tabela Particular já usa hoje pro Google Sheets (busca tudo uma vez, filtra
  no client).
- Rate limit / CORS: não é necessário CORS de browser (chamada é
  server-to-server, Next.js da Tabela Particular chamando o backend do
  flowlab) — só validar a API key.

**Blocked by:** 01 (a coluna `elegivel_desconto_particular` precisa existir
antes do endpoint poder retorná-la)

**Status:** ready-for-human

- [x] `GET api/integracoes/orcamento-particular` (ou nome equivalente) exige
      `Authorization: Bearer <TABELA_PARTICULAR_API_KEY>`, retorna 401 sem
      header válido — `api/integracoes/orcamento-particular.ts`
- [x] Resposta com sucesso: array de itens com `tuss`, `nome`, `preco`,
      `custo`, `elegivelDescontoParticular`, `conveniosAceitos`
- [x] `conveniosAceitos` lista só nomes de `fonte_pagadora` com `atendido =
      true` pra aquele TUSS, excluindo a própria linha "Particular"
- [x] Item sem correspondência em `custo_exames` (tuss não encontrado) não
      quebra a resposta — decisão tomada: mantém o item com `nome: null` e
      `custo: null` (documentado em `api/_lib/orcamentoParticular.ts`)
- [ ] Testado via curl/Postman contra o projeto de teste antes de configurar
      a env var em produção
- [ ] `TABELA_PARTICULAR_API_KEY` configurada no Vercel do flowlab
      (Production + Preview, mesmo padrão de `FLOWLAB_API_KEY`)

## Comments

Endpoint e lógica de agregação implementados e cobertos por 14 testes
(`api/_lib/orcamentoParticular.test.ts` + `api/integracoes/orcamento-particular.test.ts`),
todos passando, junto com o resto da suíte (467/467). Lint e typecheck de
`api/` limpos nos arquivos novos.

Faltam os dois últimos itens, que exigem acesso que não tenho neste
ambiente: testar contra o Supabase de teste de verdade (sem `DATABASE_URL`/
`psql` aqui, só a service role key via REST, que não expõe este endpoint) e
configurar `TABELA_PARTICULAR_API_KEY` no dashboard do Vercel. Também
depende da migration 01 já estar aplicada em teste/produção (ainda
pendente, ver comentário na issue 01) — sem a coluna
`elegivel_desconto_particular`, a query de `custo_fontes_pagadoras` falha.
