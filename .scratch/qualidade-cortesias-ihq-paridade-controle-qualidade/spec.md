# Qualidade: Cortesias e IHQ trazem dados diferentes entre flowlab e Flowlab_Controle_Qualidade

Status: needs-info

## Contexto

O parceiro relatou que o módulo Qualidade no `flowlab` (este repo, monorepo) não
está trazendo os mesmos dados de **Cortesias** e **IHQ** que o
`Flowlab_Controle_Qualidade` (repo próprio,
`github.com/techlaboratoriolab-code/Flowlab_Controle_Qualidade`), que é
adotado aqui como **fonte de verdade** de dados e comportamento.

O ponto de partida foi um mapeamento de arquivos fornecido pelo parceiro,
descrevendo a estrutura de Cortesias e IHQ com base no
`Flowlab_Controle_Qualidade`. Esse mapeamento foi conferido primeiro (ver
seção "Paridade estrutural" abaixo) e depois usado para guiar uma comparação
de lógica entre os dois repos.

Já existe uma issue de investigação separada,
`.scratch/qualidade-cortesias-valor-particular-concedido/` (status
`needs-info`), cobrindo especificamente a divergência no cálculo de Valor
Particular/Valor Concedido de Cortesias. Ela **não é duplicada aqui** — só é
referenciada onde relevante.

**Nota metodológica**: toda a comparação abaixo é **estática** (leitura de
código nos dois repos, sem executar queries reais contra o MySQL do LIS).
Validação empírica com dados reais (rodar as duas queries no mesmo
`CodRequisicao`/paciente e comparar resultados) fica para uma etapa seguinte,
com acesso e autorização explícitos — não foi feita aqui.

## Paridade estrutural (frontend / domínio / handlers)

Ao contrário da hipótese inicial ("IHQ não tem tabela espelho", "faltam
handlers"), a comparação mostrou que **a maior parte do módulo tem paridade
quase total** entre os dois repos — só os nomes/caminhos de arquivo mudam:

- Frontend: `CortesiasPage.tsx`, `CortesiasCotasPage.tsx`, `CuradoriaDrawer.tsx`,
  `NotificacoesModal.tsx`, `IhqPage.tsx`, `VinculoDrawer.tsx` existem nos dois
  repos com a mesma responsabilidade.
- Domínio: `cortesiasRegras.ts`, `cortesiasIndicadores.ts`,
  `notificacoesCortesias.ts`, `ihqRegras.ts`, `ihqIndicadores.ts` — **idênticos
  byte a byte** nos dois repos (confirmado por diff). A lógica pura de
  curadoria/status/TAT/indicadores **não é** a fonte da divergência de dados.
- Handlers: flowlab despacha as mesmas actions (`sync-cortesias`,
  `buscar-pii-cortesias`, `sync-ihq`, `buscar-pii-ihq`, `buscar-detalhe-ihq`,
  `confirmar-vinculo-ihq`) via `api/_lib/handlers/qualidade-*.ts`, em vez de
  `api/_lib/qualidade/handlers/*.ts` como no Flowlab_Controle_Qualidade — só
  muda o caminho do arquivo, a superfície de API é a mesma.
- `CortesiaDTO`, `IhqDTO`, `IhqFiltro`, `ConfirmarVinculoInput`,
  `CuradoriaIhqInput` em `types.ts` — idênticos campo a campo.

**A divergência real está toda concentrada em duas camadas**: a query direta
ao MySQL do LIS (`bdLabQualidade.ts`, consolidado e heurístico no flowlab, vs.
`bdLabCortesias.ts`/`bdLabIhq.ts`, dedicados e mais explícitos no
Flowlab_Controle_Qualidade) e no que os handlers de `sync-*` efetivamente
persistem no Supabase.

## Cortesias

### C1. Critério de origem da "cortesia" é outra tabela do LIS (mais grave)

- **flowlab** (`api/_lib/qualidade/bdLabQualidade.ts:230-236`): parte de
  `requisicaoautorizacao ra JOIN requisicao r ... LEFT JOIN fatconvenio fc
  ... LEFT JOIN evento ev ... LEFT JOIN fatrequisicaoprocedimento fp`,
  filtrando por período em `ra.DtaCriacao`. O filtro "isto é cortesia mesmo"
  é `ra.Tipo = ?`, e só é aplicado se a env `APLIS_CORTESIA_TIPO_AUTORIZACAO`
  estiver configurada (linhas 213-215) — **sem ela, a query traz qualquer
  autorização de qualquer convênio no período**.
- **Flowlab_Controle_Qualidade** (`api/_lib/qualidade/bdLabCortesias.ts:129-155`):
  parte de `requisicao r JOIN paciente p LEFT JOIN fatinstituicao fi LEFT
  JOIN exame e LEFT JOIN tarefa`, e o critério é `WHERE r.IdConvenio = ?`, um
  `IdConvenio` fixo vindo de `qa_parametros.cortesias.id_convenio_cortesia`
  (lido em `sync-cortesias.ts:120-133`). Nunca usa `requisicaoautorizacao`.
- **Impacto**: são duas heurísticas incompatíveis (tabela de autorizações vs.
  convênio fixo na requisição) — cada lado pode trazer um conjunto de
  requisições completamente diferente. Confirmado: não existe, em nenhuma
  migration do flowlab, um seed equivalente a
  `cortesias.id_convenio_cortesia` — esse parâmetro **não existe** no
  flowlab.

### C2. Joins/tabelas e origem dos campos de texto livre divergem

- flowlab usa `requisicaoautorizacao` + `fatconvenio` (nome do convênio);
  Flowlab_Controle_Qualidade usa `tarefa` (subqueries por `CodTarefaTipo` +
  `MsgTarefa LIKE prefixo%`) + `paciente` + `fatinstituicao`/`exame`.
- `autorizadoPorLis`/`observacoesLis`: no flowlab vêm direto de colunas da
  tabela (`ra.Solicitante`/`ra.Observacao`); no Flowlab_Controle_Qualidade
  vêm de parsing de texto livre em `tarefa.MsgTarefa`
  (`parseAutorizadoPor`/`parseObservacao`) — inclusive com um campo
  `parsingFalhou` que só existe lá (`bdLabCortesias.ts:38`); no flowlab esse
  campo é sempre gravado como `false` fixo (`qualidade-sync-cortesias.ts:122`).
- `fatrequisicaoprocedimento` aparece nos dois, mas agregado de forma
  diferente (reforça a divergência de Valor Particular/Concedido já aberta em
  `.scratch/qualidade-cortesias-valor-particular-concedido/`).

### C3–C5. DTO, regras de negócio e indicadores — idênticos

Sem divergência: `CortesiaDTO`, `cortesiasRegras.ts` (+ teste) e
`cortesiasIndicadores.ts` são idênticos nos dois repos.

### C6. Sincronização — upsert cego vs. controle de revisão

- **flowlab** (`api/_lib/handlers/qualidade-sync-cortesias.ts:140`): sempre
  `upsert(linhas, { onConflict: 'cod_requisicao' })`, sobrescrevendo as
  colunas de espelho mesmo se já houve curadoria manual, e nunca marca
  `revisao_pendente`.
- **Flowlab_Controle_Qualidade**: suporta `recorte: 'solicitacao' |
  'autorizacao'`, compara campo a campo antes de sobrescrever
  (`algumCampoEspelhoMudou`) e, se já curado, marca `revisao_pendente = true`
  em vez de sobrescrever silenciosamente.
- Além disso, o período sincronizado usa colunas-fonte diferentes
  (`ra.DtaCriacao` no flowlab vs. `r.DtaSolicitacao`/`fin.DtaInclusao`
  dependendo do recorte, no outro lado) — mesmo pedindo "o mesmo intervalo de
  datas", os dois filtram janelas logicamente diferentes no LIS.

### C7. CHECK constraint desatualizada em `qa_cortesias` (achado crítico)

- Migration do flowlab (`supabase/migrations/20260820120000_qualidade_piloto.sql:193`):
  `CHECK (situacao_prazo IN ('dentro_prazo', 'fora_prazo', 'sem_autorizacao'))`
  — **falta o valor `'nao_autorizada'`**.
- A regra de negócio (idêntica nos dois repos, `cortesiasRegras.ts:56`) pode
  retornar `'nao_autorizada'`, e o sync usa esse valor diretamente no payload
  de upsert (`qualidade-sync-cortesias.ts:107,124`).
- **Efeito**: assim que existir pelo menos uma cortesia "não autorizada" no
  período sincronizado, o upsert em lote inteiro viola a CHECK constraint e
  falha com 500 — **nenhuma linha daquele lote é gravada**, não só a
  problemática. Há precedente do mesmo padrão de causa (schema/código
  descompassados) já documentado em
  `supabase/migrations/20260825120000_qualidade_fix_sync_ihq_cortesias.sql`.
- Em aberto: não deu para confirmar a constraint real do lado do
  Flowlab_Controle_Qualidade (a migration lá não recria a tabela — comenta
  que `qa_cortesias` "já existe no banco compartilhado"), o que levanta uma
  pergunta maior (ver C7-Q abaixo).

### C8. Cotas — idêntico, exceto UI

`calcularEstadoCota` é idêntico nos dois repos. Única diferença: flowlab
esconde o formulário de criação de cota atrás de `useCanManageQualidade()`;
o outro sempre mostra. Não afeta dados.

## IHQ

### I1. Critério de identificação de "requisição IHQ" diverge (ponto mais provável de causar diferença de volume)

- **flowlab** (`api/_lib/qualidade/bdLabQualidade.ts:288`):
  `WHERE ev.DesEvento LIKE '%IHQ%' AND ${periodo.sql}` — heurística textual.
- **Flowlab_Controle_Qualidade** (`api/_lib/qualidade/bdLabIhq.ts:178`):
  `WHERE ihq.CodExame = ? AND ihq.DtaSolicitacao BETWEEN ? AND ?`, com
  `codExameRastreio` fixo em `13` (seed em `migration_producao_atualizada.sql:296`).
- `LIKE '%IHQ%'` pode trazer eventos correlatos indevidos (ex.: "RETORNO
  IHQ", "IHQ PARCEIRO") ou perder requisições cujo `DesEvento` não contenha
  literalmente "IHQ". O código fixo `13` é preciso, mas pode estar
  **subcontando**: o próprio `bdLabQualidade.ts` trata "IHQ/Parceiro" como
  `CodExame IN (6,12,13)` em outra seção (linhas 570-571, 616) — não dá para
  confirmar, sem acesso ao schema, se `13` sozinho é o critério certo.

### I2. Candidatas a vínculo sem filtrar por exame no flowlab

- flowlab (`bdLabQualidade.ts:332-343`): candidatas = qualquer requisição do
  mesmo `CodPaciente` na janela, excluindo só a própria `CodRequisicao` —
  **sem filtrar por `CodExame`**.
- Flowlab_Controle_Qualidade (`bdLabIhq.ts:156-172`): exclui explicitamente
  `CodExame` do próprio IHQ nas candidatas, e resolve o "vínculo escolhido"
  automaticamente em SQL.
- No flowlab, outra requisição de IHQ do mesmo paciente na janela pode
  aparecer como candidata a "biópsia original", inflando incorretamente
  `nivelConfiancaVinculo`.

### I3. Confirmação de vínculo — validação mais fraca, campos não preenchidos

- flowlab (`api/_lib/handlers/qualidade-confirmar-vinculo-ihq.ts:64-83`): só
  confirma que as duas requisições têm o mesmo `CodPaciente`; **não** exige
  que a original esteja entre as candidatas calculadas pela heurística.
- Flowlab_Controle_Qualidade: recomputa o universo de candidatas e exige que
  `codRequisicaoOriginal` esteja entre elas; ao confirmar, copia
  `materialLis`/`patologistaLis` da candidata escolhida.
- **flowlab nunca seta `material_lis`/`patologista_lis` na confirmação** —
  ficam permanentemente `null`.

### I4. Patologista — o fix "autusuario" não chegou ao caminho de IHQ

O commit recente `fix(qualidade): resolve patologista via autusuario, não
medico` foi aplicado a Câncer e a indicadores gerais, mas **não** à seção de
IHQ (`listarSolicitacoesIhqLis`, `bdLabQualidade.ts:276-305`): o único join é
`LEFT JOIN medico med ON med.CodMedico = r.CodMedico` (médico solicitante, não
patologista), e a interface `SolicitacaoIhqLis` nem define `patologistaLis`.
No outro repo, `bdLabIhq.ts:173` resolve via `LEFT JOIN autusuario aut ON
aut.IdUsuario = orig.IdPatologista` e sincroniza o valor. No flowlab,
`patologistaLis` de IHQ é **sempre `null` na origem** — não é join errado, é
ausência total da funcionalidade nesse caminho específico.

### I5. Campos de envio/retorno de bloco nunca são gravados no sync do flowlab

`qualidade-sync-ihq.ts:99-106` só mapeia `id_requisicao_ihq,
cod_requisicao_ihq, dta_admissao, dta_solicitacao_bloco,
medico_solicitante, status_lis` — **não** escreve `dta_envio_bloco`,
`dta_envio_texto_original`, `dta_retorno_bloco`, `bloco_retornou`,
`material_lis`, `patologista_lis`, apesar de essas colunas existirem no
schema (`20260820120000_qualidade_piloto.sql:215-248`). No outro repo,
`sync-ihq.ts:145-217` calcula tudo isso a partir de
`blocorequisicao`/`blocohistorico`. Consequência: no flowlab,
`IhqDTO.dtaEnvioBloco`, `.dtaRetornoBloco`, `.blocoRetornou`, `.materialLis`,
`.patologistaLis` chegam sempre `null` na UI, mesmo com o mesmo DTO/schema.

### I6. Chave natural do sync e N+1

flowlab faz upsert com `onConflict: 'cod_requisicao_ihq'`
(`sync-ihq.ts:116`), ignorando `id_tarefa_bloco`, e roda uma query MySQL
sequencial por solicitação (N+1, documentado no próprio cabeçalho do
arquivo). O outro repo usa chave dupla
`codRequisicaoIhq|idTarefaBloco` (permite duas linhas por requisição) e
resolve tudo numa única query. Pode gerar contagem de casos diferente quando
uma requisição gera mais de uma solicitação de bloco.

### I7. Tabela espelho Supabase — situação invertida em relação à hipótese inicial

O flowlab **tem** migration individual ativa e completa para
`qa_ihq_solicitacoes` (`20260820120000_qualidade_piloto.sql:215-248` +
correção em `20260825120000_qualidade_fix_sync_ihq_cortesias.sql`). O
Flowlab_Controle_Qualidade **não** tem migration individual ativa — a tabela
só existe no arquivo histórico `migration_producao_atualizada.sql`. O
flowlab também não tem nenhuma linha de `qa_parametros` para `ihq.*` — os
parâmetros que o outro repo usa (`cod_exame_rastreio`, `janela_vinculo_dias`,
`cod_evento_concluido/cancelado`, `cod_tarefa_tipo_bloco`,
`termos_envio_imuno`) **não existem** no flowlab.

### I8–I10. DTOs, regras de negócio e indicadores — idênticos

`IhqDTO`, `IhqFiltro`, `ConfirmarVinculoInput`, `CuradoriaIhqInput`,
`ihqRegras.ts` (+ teste) e `ihqIndicadores.ts` são idênticos nos dois repos.
A lógica pura de confiança/TAT/indicadores não é a fonte da divergência.

## Perguntas em aberto (needs-info)

1. **Cortesias/C1**: qual critério de origem está certo — `requisicaoautorizacao.Tipo`
   (flowlab) ou `requisicao.IdConvenio` fixo (Flowlab_Controle_Qualidade)? Precisa de
   alguém com contexto de negócio de Faturamento/Convênios para confirmar contra
   exemplos reais do LIS.
2. **Cortesias/C7**: `qa_cortesias` do flowlab e do Flowlab_Controle_Qualidade
   apontam para a **mesma instância física** de banco (LIS de backup e/ou
   Supabase)? Isso muda a interpretação de todos os achados de sync — se for a
   mesma tabela Supabase, os dois sistemas podem estar competindo por gravação.
3. **IHQ/I1**: o `CodExame` de IHQ é só `13`, ou o conjunto `(6, 12, 13)` que
   aparece na seção de IHQ/Parceiro do próprio flowlab? Precisa confirmação
   contra o schema/tabela de exames do LIS.
4. **IHQ geral**: os parâmetros `ihq.*` de `qa_parametros` (janela de vínculo,
   código de exame, termos de envio) foram deliberadamente omitidos no flowlab
   (feature incompleta, ported parcialmente) ou é uma lacuna a fechar?

## O que fazer (depois, se confirmado que são bugs)

Sem criar issues agora — a lista abaixo é candidata a virar
`.scratch/qualidade-cortesias-ihq-paridade-controle-qualidade/issues/NN-*.md`
depois que as perguntas acima forem respondidas:

1. Cortesias — alinhar critério de origem da cortesia (C1) e configurar
   `APLIS_CORTESIA_TIPO_AUTORIZACAO` ou portar a lógica de `IdConvenio` fixo,
   conforme a resposta à pergunta 1.
2. Cortesias — corrigir a CHECK constraint de `situacao_prazo` para incluir
   `'nao_autorizada'` (C7) — bug com evidência forte, provável fix
   independente das outras respostas.
3. Cortesias — decidir se o upsert de sync deve respeitar curadoria já feita
   (`revisao_pendente`), como no Flowlab_Controle_Qualidade (C6).
4. IHQ — alinhar critério de identificação de requisição IHQ (I1), conforme
   resposta à pergunta 3.
5. IHQ — filtrar candidatas a vínculo por `CodExame` (I2) e reforçar a
   validação em `confirmar-vinculo-ihq` (I3).
6. IHQ — portar a resolução de patologista via `autusuario` para o caminho de
   IHQ (I4).
7. IHQ — persistir os campos de envio/retorno de bloco e material/patologista
   no sync (I5).
8. IHQ — avaliar chave dupla `cod_requisicao_ihq|id_tarefa_bloco` e eliminar
   o N+1 do sync (I6).
9. IHQ — decidir se os parâmetros `ihq.*` de `qa_parametros` devem ser
   portados para o flowlab (pergunta 4).

Relacionado: `.scratch/qualidade-cortesias-valor-particular-concedido/`
(needs-info, Cortesias/Valor Particular-Concedido) segue como issue própria,
não duplicada aqui.
