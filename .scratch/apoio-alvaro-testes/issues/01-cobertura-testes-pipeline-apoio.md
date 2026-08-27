Status: done
Type: test-coverage

# Pipeline de envio ao Apoio (Álvaro/AOL) sem nenhum teste automatizado

## Onde

- `api/_lib/apoio/xmlAol.ts` — geração do XML (`gerarXmlAlvaro`, `dataParaIso`), injeção de
  credenciais (`injetarCredenciais`), e parsing das respostas (`avaliarRespostaAol`,
  `extrairIdAlvaro`, `extrairDadosXmlEnvio`).
- `api/_lib/apoio/aol.ts:24-40` — `enviarSolicitacaoAol`, o `PUT /webserviceaol/rest/producao`
  de verdade.
- `api/_lib/handlers/apoio-transferir.ts` — a rota `POST /api/analises-clinicas/apoio-transferir`
  que orquestra tudo: lê `ac_apoio_fila`, chama `enviarSolicitacaoAol`, avalia a resposta e
  upserta `ac_apoio_requisicoes` (`persistirRequisicaoEnviada`, linhas 49-82).

## Problema

Nenhum desses arquivos tem teste. `npx vitest run` filtrado pro módulo de Análises Clínicas
passa 77/77, mas nenhum desses testes toca este pipeline — confirmado em 27/08/2026 ao
investigar se o "envio Álvaro" está funcionando (grep por `apoio/aol`, `apoio-transferir`,
`apoio/xmlAol` em todos os `*.test.ts` do repo: zero ocorrências).

O handler tem efeito colateral real e irreversível — o próprio comentário do arquivo avisa
("ATENÇÃO: cria OS de verdade no laboratório de apoio", `apoio-transferir.ts:10`) — então não
dá pra validar rodando contra o Álvaro de verdade em CI. A única forma seria mockar `fetch`
(padrão já usado no repo, ver `src/modules/analises-clinicas/api.test.ts`).

## O que fazer

Cobrir os dois grupos:

**Funções puras** (`xmlAol.ts` — sem I/O, fácil de testar direto):
- `avaliarRespostaAol`: HTTP fora de 2xx → `{ok:false}`; corpo vazio → `{ok:false}`; XML
  inválido sem `incluido="false"` → `{ok:true}` (linha 229, hoje trata "não parseou" como
  sucesso silencioso — vale um teste que documente esse comportamento, é surpreendente);
  `incluido="false"` → erro com `idLis`; `amostra` com `informacao` preenchida → erro por
  amostra; múltiplas falhas → trunca em 3 + sufixo `(+N detalhe(s))` (linha 249-250).
- `extrairIdAlvaro`: XML válido com `idAlvaro`; XML inválido mas com `idAlvaro="..."` solto no
  texto (fallback regex, linha 270); resposta vazia ou sem o atributo → `''`.
- `extrairDadosXmlEnvio`: XML completo; XML vazio/inválido → objeto com campos `''`.
- `injetarCredenciais`: com `AOL_SENHA` setada substitui `senha=`, `idagente=`, `chave=`; sem
  `AOL_SENHA` retorna o XML inalterado (linha 175 — esse é o caso perigoso: envio silencioso
  com placeholder `__ENV__` se a env não estiver configurada, vale um teste que trave esse
  comportamento explicitamente).
- `dataParaIso`: `DD/MM/AAAA`, `AAAA-MM-DD`, string com hora, entrada irreconhecível → `null`.

**`enviarSolicitacaoAol`** (`aol.ts`, mock de `fetch` global):
- sucesso (200 + corpo) devolve `{httpStatus, texto}`;
- sem `AOL_IDAGENTE`/`AOL_SENHA` configuradas não manda header `Authorization` (linha 19,
  `basicAuth` retorna `null`);
- timeout (`AbortSignal.timeout`) propaga como rejeição.

**`enviarItem` / handler `apoio-transferir`** (mock de `fetch` e do client Supabase — mesmo
padrão de `api.test.ts`):
- item não encontrado na fila → `{ok:false, erro:'Registro não encontrado'}`;
- status atual não é `aguardando`/`enviando` → erro sem chamar `enviarSolicitacaoAol`;
- item sem `xml_envio` → erro sem chamar `enviarSolicitacaoAol`;
- envio com sucesso (HTTP 2xx + `avaliarRespostaAol` ok) → fila vira `enviado`,
  `persistirRequisicaoEnviada` chamado, `requisicoes_salvo: true`;
- envio com sucesso HTTP mas `avaliarRespostaAol` reprova (regra de negócio) → fila vira
  `erro`, **não** chama `persistirRequisicaoEnviada`;
- `enviarSolicitacaoAol` falha (rede/timeout) → fila vira `erro` com a mensagem (branch do
  `catch` em `handler`, linhas 166-175);
- sucesso no envio mas `persistirRequisicaoEnviada` falha (ex.: `extrairIdAlvaro` não achou
  nada) → fila continua `enviado` e a resposta HTTP inclui `requisicoes_salvo: false` +
  `requisicoes_erro` (linhas 126-135 — é o caso "enviou mas não vinculou", crítico pro board:
  sem esse vínculo a issue anterior sobre descoberta de OS no LAB-HUB não acha a OS);
- múltiplos `ids` no body: um item falhando não interrompe os outros (loop sequencial,
  linha 165-176);
- `POST` sem `ids` ou com array vazio/não-string → 400 antes de tocar Supabase.

## Critérios de aceite

- Novos arquivos `*.test.ts` ao lado de `xmlAol.ts`, `aol.ts` e `apoio-transferir.ts` (ou em
  `__tests__/` seguindo a convenção já usada no módulo).
- `npx vitest run api/_lib/apoio api/_lib/handlers/apoio-transferir.ts` passa 100% verde.
- Nenhum teste faz chamada de rede real nem grava no Supabase real — tudo mockado.

## Comments

- 27/08/2026: Implementado. Novos arquivos `api/_lib/apoio/xmlAol.test.ts` (21 testes),
  `api/_lib/apoio/aol.test.ts` (4 testes) e `api/_lib/handlers/apoio-transferir.test.ts`
  (11 testes) — 36 testes cobrindo os dois grupos e todos os casos listados acima, incluindo
  o branch crítico "enviou mas não vinculou" (`requisicoes_salvo: false`). `npx vitest run
  api/_lib/apoio api/_lib/handlers/apoio-transferir.test.ts` passa 36/36. Suite completa
  (221 testes) e `tsc --noEmit` seguem verdes. Revisado via `/code-review` (eixos Standards e
  Spec) — sem achados de spec; dois nitpicks de padronização (string de fixture XML duplicada,
  nome de teste com número de linha) corrigidos.
