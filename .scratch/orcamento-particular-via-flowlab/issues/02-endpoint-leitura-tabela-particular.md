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

**Status:** done

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
- [x] Testado via curl/Postman contra o projeto de teste antes de configurar
      a env var em produção
- [x] `TABELA_PARTICULAR_API_KEY` configurada no Vercel do flowlab
      (Production + Preview, mesmo padrão de `FLOWLAB_API_KEY`)

## Comments

Endpoint e lógica de agregação implementados e cobertos por 16 testes
(`api/_lib/orcamentoParticular.test.ts` + `api/integracoes/orcamento-particular.test.ts`),
todos passando, junto com o resto da suíte (469/469). Lint e typecheck de
`api/` limpos nos arquivos novos. Code review encontrou 4 pontos: coerção
`Number()` nas colunas NUMERIC (PostgREST pode devolver string — corrigido),
duplicação da lógica de validação Bearer com `labhubIntegration.ts`
(extraída pra `api/_lib/bearerAuth.ts` — corrigido), falta de dedup por
`tuss` já que a tabela não tem `UNIQUE(tuss)` (corrigido com `Map`), e um
quarto ponto sobre filtrar a própria linha Particular por `atendido` — não
apliquei: contradiz a premissa da issue 01, que usa `atendido` justamente
como exemplo de "coluna que só importa pra um subconjunto de linhas"
(o subconjunto não-Particular).

**Atualização:** usuário aplicou a migration 01 em teste e configurou
`TABELA_PARTICULAR_API_KEY` em `.env`. Testei de ponta a ponta: subi
`vercel dev` local (porta 3111) contra o Supabase de teste
(`eqzqkztgzcngnxmihdom`) e chamei o endpoint de verdade via curl —

- sem header / chave errada → 401 (2/2)
- `POST` → 405
- chave certa → 200, 361 itens (= total de linhas `fonte_pagadora='Particular'`
  em teste), sem `tuss` duplicado, `preco`/`custo` vindo como número (não
  string — confirma a coerção), 48 itens com `elegivelDescontoParticular:
  true` batendo exatamente com a lista de TUSS da migration 01, e
  `conveniosAceitos` populado com nomes reais de convênio pros TUSS
  atendidos.

Falta só configurar `TABELA_PARTICULAR_API_KEY` no dashboard do Vercel
(Production + Preview) e aplicar a migration 01 em produção antes de apontar
a integração pra lá — nenhum dos dois está ao meu alcance neste ambiente.

**Atualização final:** ambos concluídos pelo usuário —
`TABELA_PARTICULAR_API_KEY` configurada no Vercel do flowlab (Production +
Preview) e migration 01 aplicada em produção. Validei em produção via curl
contra `https://flow-lab.vercel.app/api/integracoes/orcamento-particular`
com a chave real: 200, 360 itens (= linhas `fonte_pagadora='Particular'` em
produção), payload no formato esperado (`elegivelDescontoParticular`,
`conveniosAceitos`, etc.). Também confirmei ponta a ponta pelo lado da
Tabela Particular: `GET https://tabela-particular.vercel.app/api/orcamento-particular`
(rota deles, que chama esta) também devolve 200 com os mesmos dados. Ticket
concluído.
