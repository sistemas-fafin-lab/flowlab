# Revisão — Contas a Receber (faturamento)

Documento vivo da revisão do plano de Contas a Receber, etapa a etapa. Cada
etapa tem o que foi **verificado** (com a evidência que sustenta a afirmação) e
os **achados** ainda em aberto.

- Plano de origem: `~/.claude/plans/agora-que-eu-j-foamy-minsky.md`
- Branch: `feature/faturamento-lotes-aplis`
- Migrations: `20260807120000_contas_receber.sql`, `20260807130000_contas_receber_rpcs.sql`

**Status das etapas**

| Etapa | Escopo | Revisão |
|---|---|---|
| 1 | Migration de adaptação | ✅ revisada em 07/08/2026 — 3 achados |
| 2 | RPCs Postgres | ✅ revisada em 07/08/2026 — 6 achados |
| 3 | API (rotas serverless) | ✅ revisada em 07/08/2026 — 5 achados |
| 4 | Frontend | ✅ revisada em 07/08/2026 — 9 achados |
| 5 | Importação do demonstrativo TISS | fora do escopo desta entrega |

**Conferência pós-migration no eqz (07/08/2026)** — depois de as duas migrations
serem aplicadas no banco de test, o ciclo de vida completo de um título foi
exercitado lá pelas RPCs reais, com token de usuário de verdade, e o banco foi
devolvido linha a linha ao estado anterior. Tudo bateu com o que o cluster local
tinha previsto:

```
fat_criar_titulo          1.500 em 2 lotes | 2 vínculos | 2 guias congeladas | criado_por preenchido
lote já faturado          recusado: "Lote(s) 999801, 999802 já pertencem a um título ativo."
baixa 600 + glosa def 400 recebido   600 | glosado 400 | saldo   500 | parcialmente_recebida
+ baixa de 500            recebido 1.100 | glosado 400 | saldo     0 | liquidada
+ baixa de 2.500          ACEITA      →   saldo -2.500 | recebida            ← achado 4.4
estorno (DELETE)          recebido     0 | glosado 400 | saldo 1.100 | glosada
                          glosa sobreviveu com recebimento_id NULL           ← SET NULL ok
```

Colunas, CHECK de `notas.status` e as três RPCs estão no eqz. O eqz já tem
`canManageBilling` em 1 dos 7 cargos (`Desenvolvedor Master`), atribuído a 4
perfis, então a tela já pode ser testada com esses usuários. O uso ainda não
está liberado para todos os cargos, e o jqx segue sem as migrations (ver
[4.3](#43--a-tela-ainda-tem-bloqueios-de-ambiente)). A conferência revelou um
achado novo,
[1.4](#14--fat_recalcular_nota-é-chamável-por-qualquer-usuário-autenticado).

**Achados**

Alta/média fechados em 10/08/2026 (`66d33f5`, `a2e8475`); baixa/nit fechados em
10/08/2026 (`20260810140000_revisao_contas_receber_baixa_severidade.sql` +
ajustes de API/frontend). `2.5` foi mantido como está por decisão própria do
achado ("provavelmente não vale corrigir"); `4.3` é checklist de deploy, sem
código a mudar.

| # | Etapa | Severidade | Título | Status |
|---|---|---|---|---|
| [1.1](#11--usebillingupdateglosastatus-contradiz-a-trigger-nova) | 1 | alta | `useBilling.updateGlosaStatus` contradiz a trigger nova | ✅ fechado |
| [1.2](#12--índice-duplicado-em-recebimentos) | 1 | baixa | Índice duplicado em `recebimentos` | ✅ fechado |
| [1.3](#13--nits) | 1 | nit | `REVOKE` fora da etapa 1; comentário impreciso | ✅ fechado |
| [1.4](#14--fat_recalcular_nota-é-chamável-por-qualquer-usuário-autenticado) | 1 | média | `fat_recalcular_nota` é chamável por qualquer usuário autenticado | ✅ fechado |
| [2.1](#21--cnpj-repetido-entre-fontes-pagadoras-derruba-a-criação-do-título) | 2 | média | CNPJ repetido entre fontes pagadoras derruba a criação do título | ✅ fechado |
| [2.2](#22--os-kpis-do-período-ignoram-o-cancelamento-do-título) | 2 | média | Os KPIs do período ignoram o cancelamento do título | ✅ fechado (reescrita 20260807140000/150000) |
| [2.3](#23--valortotal-somado-sem-deduplicar-lotes) | 2 | baixa | `valorTotal` somado sem deduplicar lotes | ✅ fechado |
| [2.4](#24--glosa-não-é-validada-contra-o-título) | 2 | baixa | Glosa não é validada contra o título | ✅ fechado |
| [2.5](#25--reaproveitar-lote-de-título-cancelado-reescreve-o-snapshot-antigo) | 2 | baixa | Reaproveitar lote de título cancelado reescreve o snapshot antigo | ⚪ mantido (decisão do próprio achado) |
| [2.6](#26--nits) | 2 | nit | `qtdTitulos` ambíguo; `created_at::DATE` no fuso da sessão | ✅ fechado |
| [3.1](#31--operadoras-sync-quebra-de-vez-quando-o-cnpj-já-está-com-a-irmã) | 3 | média | `operadoras-sync` quebra de vez quando o CNPJ já está com a irmã | ✅ fechado |
| [3.2](#32--título-sem-vencimento-não-tem-como-ganhar-um-depois) | 3 | média | Título sem vencimento não tem como ganhar um depois | ✅ fechado |
| [3.3](#33--o-snapshot-do-cabeçalho-vem-do-cache-o-das-guias-não) | 3 | baixa | O snapshot do cabeçalho vem do cache; o das guias, não | ✅ fechado |
| [3.4](#34--somentesemtitulo-recorta-a-página-depois-de-paginar) | 3 | baixa | `somenteSemTitulo` recorta a página depois de paginar | ✅ fechado (mitigado; ver nota) |
| [3.5](#35--nits) | 3 | nit | Soma float na resposta; emissão em UTC; vencimento mais tardio | ✅ fechado |
| [4.1](#41--a-seleção-de-lotes-sobrevive-à-troca-de-filtro-e-entra-no-título-invisível) | 4 | alta | A seleção de lotes sobrevive à troca de filtro e entra no título invisível | ✅ fechado |
| [4.2](#42--o-modal-de-criação-só-alcança-50-lotes-e-não-tem-paginação) | 4 | média | O modal de criação só alcança 50 lotes e não tem paginação | ✅ fechado |
| [4.3](#43--a-tela-ainda-tem-bloqueios-de-ambiente) | 4 | média | A tela ainda tem bloqueios de ambiente | ⚪ checklist de deploy, sem código |
| [4.4](#44--baixa-maior-que-o-saldo-é-aceita-e-deixa-o-título-com-saldo-negativo) | 4 | média | Baixa maior que o saldo é aceita e deixa o título com saldo negativo | ✅ fechado |
| [4.5](#45--a-aba-dashboard-não-tem-controle-nenhum) | 4 | baixa | A aba Dashboard não tem controle nenhum | ✅ fechado (`FiltrosReceber.tsx`) |
| [4.6](#46--glosas-e-recursos-agora-falha-em-silêncio) | 4 | baixa | "Glosas e Recursos" agora falha em silêncio | ✅ fechado |
| [4.7](#47--tituloidtitulonumero-nunca-chega-à-aba-faturas) | 4 | baixa | `tituloId`/`tituloNumero` nunca chega à aba Faturas | ✅ fechado |
| [4.8](#48--erro-ao-carregar-guias-é-exibido-como-nenhuma-guia) | 4 | baixa | Erro ao carregar guias é exibido como "nenhuma guia" | ✅ fechado |
| [4.9](#49--nits) | 4 | nit | Seletor de operadoras desatualizado; erro em azul; dois "hoje" | ✅ fechado |

---

## Etapa 1 — Migration de adaptação

Revisada em 07/08/2026 contra `supabase/migrations/20260807120000_contas_receber.sql`.

### Como foi verificado

Cluster Postgres descartável (procedimento de `validar-migration-postgres-local`),
com um prelúdio mínimo de Supabase — roles `anon`/`authenticated`/`service_role`,
`auth.users`, `auth.uid()` lendo `request.jwt.claim.sub`, `user_profiles`,
`custom_roles` e `current_user_has_permission` copiada de
`20260721120000_user_soft_delete.sql`. Depois: `20260320_billing_module.sql` →
migration nova → migration nova de novo.

### Verificado ✅

**Migration** — aplica limpa sobre a base; a segunda execução sai com exit 0 e só
`NOTICE` de "already exists". É idempotente de verdade.

**Trigger** — os quatro defeitos que o plano listou estão corrigidos. Sequência
do roteiro de verificação, valores lidos de `notas` a cada passo:

| passo | status | recebido | glosado | saldo |
|---|---|---|---|---|
| título de 1000 | `aberta` | 0 | 0 | 1000 |
| baixa de 600 | `parcialmente_recebida` | 600 | 0 | 400 |
| glosa definitiva de 400 | `liquidada` | 600 | 400 | 0 |
| `DELETE` da baixa | `glosada` | 0 | 400 | 600 |

Casos além do roteiro, todos corretos:

- `revertida` tira o valor do glosado e devolve o saldo a cobrável;
- remanejar uma baixa (`UPDATE recebimentos SET nota_id = outro`) recalcula **os
  dois** títulos — o de origem volta a `aberta`, o de destino fecha;
- `cancelada` é grudenta: uma baixa nova não ressuscita o título;
- apagar um título que tem baixas e glosas não estoura — o `ON DELETE SET NULL`
  dispara a trigger com `NEW.nota_id IS NULL` e os guards de `NULL` /
  `NOT FOUND` absorvem;
- a FK `glosas.recebimento_id` virou `SET NULL`: estornar a baixa preserva a
  glosa, que é o fato da operadora e não um detalhe do nosso pagamento.

**RLS** — com `SET ROLE authenticated` e `auth.uid()` vindo do GUC:

| perfil | `SELECT notas` | `INSERT recebimentos` |
|---|---|---|
| custom role sem permissão de faturamento | 0 linhas | recusado pela policy |
| só `canViewBilling` | 1 linha | recusado pela policy |
| `canManageBilling` | 1 linha | passa, e a trigger atualiza o título |

**Registro da permissão** — `canManageBilling` está em `ALL_PERMISSION_KEYS`
(`src/utils/permissions.ts:28`) e em `RolePermissions` (`src/types/index.ts:236`).
Consulta ao eqz em 07/08/2026: 1 dos 7 cargos tem a permissão
(`Desenvolvedor Master`) e 4 dos 46 perfis estão associados a ele. Esses 4
perfis recebem `canManageBilling` no frontend. No banco, o ramo
`p.role = 'admin'` da `current_user_has_permission` também dá permissão efetiva
aos 6 perfis com role legada `admin`, embora 4 deles continuem sem os botões no
frontend enquanto seus cargos customizados não tiverem a chave. O jqx ainda
precisa ser conferido no deploy.

**Derrubar o CHECK de `lotes.status`** é coerente com o consumidor: a
`fat_criar_titulo` grava o rótulo STLOT em `status`
(`20260807130000_contas_receber_rpcs.sql:142`), e o código numérico vai para
`status_aplis`.

---

### 1.1 — `useBilling.updateGlosaStatus` contradiz a trigger nova

**Severidade:** alta · **Status:** ✅ fechado

`src/hooks/useBilling.ts:332-338` — ao marcar uma glosa como `revertida`, o hook
soma o valor dela em `recebimentos.valor_recebido`. Com a trigger nova isso
conta o valor duas vezes, na direção errada. Reproduzido no cluster:

```
liquidada              600 recebido /  400 glosado / saldo 0
→ glosa vira 'revertida' (passo 1 do hook):
parcialmente_recebida  600 recebido /    0 glosado / saldo 400   ✅
→ soma no recebimento (passo 2 do hook, linhas 332-338):
recebida              1000 recebido /    0 glosado / saldo 0     ❌
```

O título é dado como quitado sem que os 400 tenham entrado.

**Causa:** duas definições de `revertida` convivendo. A migration documenta
(linha 211) que `revertida` = "o recurso foi ganho e o valor voltou a ser
cobrável"; o hook assume "a operadora pagou depois do recurso". Enquanto as
tabelas estavam vazias isso nunca disparou — as etapas 1-4 as colocam em uso e
`/faturamento/glosas` opera nas mesmas linhas.

**Agravante:** a rota é gateada só por `canViewBilling` (`src/App.tsx:256`), então
o botão de recurso passa a falhar por RLS para quem tem só leitura.

**Decisão pendente:** `RecebimentosList` foi removida, mas `GlosasRecursos` e o
`useBilling` ficaram fora do reescopo. Três caminhos:

1. reescrever `GlosasRecursos` sobre as RPCs novas e aposentar o `useBilling`
   (coerente com o resto da entrega, mais trabalho);
2. cirurgia mínima: apagar o passo 2 (linhas 316-341) e trocar o gate da rota
   para `canManageBilling` nas ações de escrita;
3. tirar a rota do ar até a etapa 5.

### 1.2 — Índice duplicado em `recebimentos`

**Severidade:** baixa · **Status:** ✅ fechado

`20260807120000_contas_receber.sql:355` cria `idx_recebimentos_data_receb_valor`,
que o `pg_indexes` mostra idêntico ao `idx_recebimentos_data_receb` já vindo da
base (`20260320_billing_module.sql:134`) — mesmo btree, só `data_receb`. O nome
promete uma coluna `valor` que não está no índice.

**Sugestão:** ou remover, ou fazer dele `(data_receb, valor_recebido)`, que é o
que o KPI de recebido-no-período realmente varre.

Na mesma linha, agora são prefixos redundantes dos compostos novos:
`idx_notas_data_vencimento` (⊂ `idx_notas_vencimento_status`) e `idx_glosas_nota`
(⊂ `idx_glosas_nota_status`). Inofensivos, mas a migration já está curando
índices e poderia derrubá-los.

### 1.3 — Nits

**Severidade:** nit · **Status:** ✅ fechado

- **`REVOKE` de `fat_recalcular_nota` mora na migration errada.** Está só na
  etapa 2 (`20260807130000_contas_receber_rpcs.sql:439`). Funciona porque as duas
  sobem juntas, mas deixa a etapa 1 sozinha com um `SECURITY DEFINER` aberto a
  `PUBLIC`. Mover o `REVOKE` para a etapa 1 mantém a migration autossuficiente,
  como o resto dela — mas **não basta**: ver [1.4](#14--fat_recalcular_nota-é-chamável-por-qualquer-usuário-autenticado).
- **Comentário impreciso na linha 84.** Diz que `valor_saldo` é `STORED` "porque
  o aging filtra e ordena por ele em toda listagem de títulos abertos". Nada
  filtra nem ordena por `valor_saldo`: `useContasReceber` ordena por
  `data_vencimento`/`data_emissao` e a `fat_dashboard_receber` filtra por
  `status` + `data_vencimento`. `STORED` continua sendo a escolha certa (não
  existe `VIRTUAL` antes do PG 18), só o motivo está errado.

### 1.4 — `fat_recalcular_nota` é chamável por qualquer usuário autenticado

**Severidade:** média · **Status:** ✅ fechado — descoberto em 07/08/2026, já com
as duas migrations aplicadas no eqz

`REVOKE ALL ON FUNCTION … FROM PUBLIC` **não fecha nada no Supabase.** O projeto
traz `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon,
authenticated, service_role`, então toda função criada em `public` nasce com um
`GRANT EXECUTE` **explícito** para esses roles — e revogar de `PUBLIC` não mexe
num grant explícito.

Medido no eqz com token real de cada perfil:

```
perfil            SELECT notas   fat_dashboard   fat_recalcular_nota
admin              6 visíveis     ok              PERMITIDO
canViewBilling     6 visíveis     ok              PERMITIDO
sem permissão      0 visíveis     42501           PERMITIDO  ⚠
```

O usuário que não enxerga um único título executa uma função `SECURITY DEFINER`
que dá `UPDATE` em `notas` ignorando a RLS, para qualquer `id_nota` que ele
chute. `fat_exigir_permissao_gestao` também está exposta: ela responde 42501, ou
seja, **executou** e levantou a exceção de dentro — não foi barrada no `GRANT`.

O dano direto continua limitado, como o 1.3 dizia — a função recalcula a partir
das próprias baixas e glosas, não fabrica valor. O que mudou é a correção: mover
o `REVOKE` para a etapa 1, como o 1.3 propunha, **não resolveria**. Precisa
revogar dos roles nominalmente:

```sql
REVOKE ALL ON FUNCTION public.fat_recalcular_nota(UUID)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fat_exigir_permissao_gestao()  FROM PUBLIC, anon, authenticated;
```

Vale conferir o mesmo padrão nas outras `SECURITY DEFINER` do repositório (as
`ac_*`), que provavelmente carregam a mesma suposição. **Não foi medido se
`anon` (sem login) também alcança** — não há chave anon do eqz no `.env` — mas
as default privileges do Supabase cobrem `anon` igual, então trate como se sim
até alguém verificar.

---

## Etapa 2 — RPCs Postgres

Revisada em 07/08/2026 contra `supabase/migrations/20260807130000_contas_receber_rpcs.sql`.

### Como foi verificado

Mesmo cluster descartável da etapa 1, banco novo: prelúdio Supabase →
`20260320_billing_module.sql` → `20260807120000` → `20260807130000` → a de RPCs
de novo (idempotência). Depois um roteiro de 20 casos rodando como três usuários
de verdade (`SET ROLE authenticated` + `auth.uid()` no GUC): sem permissão de
faturamento, só `canViewBilling`, e `canManageBilling`. A corrida do lote duplo
foi testada com duas sessões `psql` simultâneas e janela forçada de 10s.

### Verificado ✅

**Migration** — aplica limpa e a segunda passada sai com exit 0.

**Permissão** — o guard funciona nas três RPCs:

| chamada | sem permissão | `canViewBilling` | `canManageBilling` |
|---|---|---|---|
| `fat_criar_titulo` | 42501 | 42501 | passa |
| `fat_registrar_baixa` | 42501 | 42501 | passa |
| `fat_dashboard_receber` | 42501 | passa | passa |

`fat_exigir_permissao_gestao` não tem `GRANT` para `authenticated` e chamá-la
direto dá `permission denied` — correto: ela só é usada de dentro das outras
`SECURITY DEFINER`, que rodam como owner.

**`fat_criar_titulo`** — payload de 2 lotes com 3 guias gravou 2 `lotes`, 3
`requisicoes`, 2 `nota_lote`, `notas.valor_total = 1000` e `criado_por`
preenchido a partir de `auth.uid()`. Recusa o lote que já está em título ativo
(`Lote(s) 6424 já pertencem a um título ativo.`) e volta a aceitá-lo depois de o
título ser cancelado.

**`fat_registrar_baixa`** — baixa de 600 com glosa definitiva de 400 num título
de 1000 deixou `liquidada / 600 recebido / 400 glosado / saldo 0`, com
`aplis_sync_status = 'pendente'` e `registrado_por_id` preenchido. As recusas
todas pegam: título cancelado, título inexistente, `notaId` ausente, e valor 0
sem nenhuma glosa. **Atomicidade confirmada:** glosa sem motivo derruba a baixa
inteira — depois do erro `recebimentos` continuava com a única linha anterior.

**`fat_dashboard_receber`** — cenário com um título liquidado, um vencido há 100
dias (2000) e um a vencer em 20 dias (500):

| campo | valor | confere |
|---|---|---|
| `totalReceber` | 2500 | ✅ |
| `vencido` | 2000 | ✅ |
| `aging.a_vencer` / `d90_mais` | 500 / 2000 | ✅ |
| `prazoMedioDias` | 2.0 | ✅ (recebeu 12/08, vencia 10/08) |
| `percentualGlosa` Unimed | 13.3 | ✅ (400 de 3000) |
| `serieMensal` | 3 competências em ordem | ✅ |

**Corrida do lote duplo** — a checagem de duplicidade não toma lock, mas na
prática a janela está fechada: o upsert de `operadoras` acontece *antes* dela, e
duas criações concorrentes sobre o mesmo lote são necessariamente da mesma
operadora (o lote tem uma fonte pagadora só, e é o handler que a deriva). Testado
com janela de 10s: a segunda transação bloqueou no upsert da operadora, esperou o
commit da primeira e então recusou corretamente. Forçando operadoras diferentes
no payload — só alcançável chamando a RPC na mão — o mesmo lote entra em dois
títulos ativos. Vale registrar que a garantia é **acidental**: mover o upsert da
operadora para depois da checagem, ou passar a cachear o `id_operadora`, reabre a
janela.

---

### 2.1 — CNPJ repetido entre fontes pagadoras derruba a criação do título

**Severidade:** média · **Status:** ✅ fechado

O upsert de operadora (`20260807130000:85-92`) usa `ON CONFLICT (aplis_id)`, mas
`operadoras.cnpj` também é `UNIQUE` (`20260320_billing_module.sql:12`). Quando
uma fonte pagadora nova traz um CNPJ que já pertence a outra operadora, o
conflito acontece na constraint errada e não é tratado:

```
ERROR:  duplicate key value violates unique constraint "operadoras_cnpj_key"
DETAIL:  Key (cnpj)=(11.111.111/0001-11) already exists.
```

Não é hipotético: `fatinstituicao` cadastra matriz e filial, e planos distintos
da mesma operadora, como fontes pagadoras separadas com o mesmo CNPJ. O handler
repassa `error.message` como 400 (`faturamento-titulo-criar.ts:246`), então o
operador recebe essa mensagem crua na tela e o título simplesmente não é criado.

**Sugestão:** derrubar o `UNIQUE` de `operadoras.cnpj` — quem manda é `aplis_id`,
e o apLIS admite CNPJ repetido. Se preferir manter a constraint, gravar o CNPJ
só quando ele ainda não estiver em uso por outra `aplis_id`.

### 2.2 — Os KPIs do período ignoram o cancelamento do título

**Severidade:** média · **Status:** ✅ fechado

`por_operadora` e `serie_mensal` filtram `n.status <> 'cancelada'`
(linhas 402 e 418); as CTEs `recebido_periodo` e `glosado_periodo` (338-356) não.
Na mesma tela, o card e o gráfico passam a se contradizer. Reproduzido —
cancelando um título que tinha baixa de 600 no período:

```
kpis.recebidoPeriodo : 600.00      ← continua contando
serieMensal          : a linha inteira de 2026-07 desapareceu
                       (era faturado 1000 / recebido 600 / glosado 400)
```

**Sugestão:** acrescentar `AND n.status <> 'cancelada'` às duas CTEs, ou tirar o
filtro das outras duas — o que importa é escolher uma definição só. A primeira
opção é a coerente com o resto: título cancelado não é receita.

### 2.3 — `valorTotal` somado sem deduplicar lotes

**Severidade:** baixa · **Status:** ✅ fechado

A soma (linhas 113-115) percorre `jsonb_array_elements(p->'lotes')` elemento a
elemento, enquanto `nota_lote` tem PK composta e grava um vínculo só. O mesmo
`aplisId` repetido no array infla o título. Reproduzido:

```
payload com o lote 9001 duas vezes  →  NF-DUP: valor_total 800.00, lotes vinculados 1
```

O título passa a cobrar o dobro do que os lotes vinculados somam. O handler
deduplica (`new Set`, `faturamento-titulo-criar.ts:117`), então isso não é
alcançável pela tela — mas a RPC tem `GRANT EXECUTE … TO authenticated` e o mesmo
usuário do financeiro pode chamá-la direto pelo supabase-js.

**Sugestão:** deduplicar por `aplisId` dentro da própria RPC, na soma e no loop —
ela é quem promete atomicidade e não deveria depender de o chamador ter limpado o
payload.

### 2.4 — Glosa não é validada contra o título

**Severidade:** baixa · **Status:** ✅ fechado

`fat_registrar_baixa` insere as glosas (linhas 280-289) sem conferir nada além do
motivo:

- **`requisicaoId`/`loteId` de outro título são aceitos.** Testado: uma glosa do
  título NF-1 gravou `requisicao_id` de uma guia que pertence a outro título. O
  rateio por guia passa a apontar para fora, e o demonstrativo por guia mente.
- **Não há teto.** Glosa de 5000 num título de 1000 passa e deixa
  `valor_saldo = -5000` (status continua `liquidada`). O aging escapa porque
  filtra `valor_saldo > 0`, mas `porOperadora.saldo` soma sem esse filtro — com um
  saldo negativo em cena, a soma do gráfico deixa de bater com o KPI
  `totalReceber`.

**Sugestão:** validar que `requisicao_id`/`lote_id` pertencem ao `notaId` da baixa
(um `EXISTS` por glosa) e recusar quando `recebido + glosas > valor_total`, ou ao
menos avisar. As duas checagens são baratas e este é o ponto onde o valor do
título é decidido.

### 2.5 — Reaproveitar lote de título cancelado reescreve o snapshot antigo

**Severidade:** baixa · **Status:** ⚪ mantido — decisão do próprio achado, ver "Sugestão" abaixo

O snapshot é por `lotes.aplis_id`, não por (título, lote). Quando um título é
cancelado e o lote entra num título novo, o `ON CONFLICT (aplis_id) DO UPDATE`
(linhas 152-165) sobrescreve a linha que o título cancelado ainda referencia:

```
NF-1 (cancelada)  valor do título 1000.00   valor do lote hoje  999.00
NF-4 (nova)       valor do título  999.00   valor do lote hoje  999.00
```

A linha expandida do título cancelado passa a mostrar lotes que não somam o valor
dele. Só afeta histórico de cancelados, e a promessa de snapshot congelado
continua valendo para todo título ativo — que é o caso que importa.

**Sugestão:** provavelmente não vale corrigir (snapshot por par título↔lote é
mudança de modelo). Fica documentado para quando alguém estranhar o número.

### 2.6 — Nits

**Severidade:** nit · **Status:** ✅ fechado

- **`qtdTitulos` quer dizer duas coisas no mesmo payload.** Em `kpis` conta só os
  títulos em aberto (2 no teste); em `porOperadora` conta todos os não cancelados
  (soma 3). Mesmo nome, definições diferentes, lado a lado na mesma tela.
- **`g.created_at::DATE` converte no fuso da sessão** (linha 354), que no Supabase
  é UTC. Glosa lançada depois das 21h em Brasília cai no dia seguinte — e no dia
  31 do mês, no mês seguinte, deslocando `glosadoPeriodo` na virada. Usar
  `(g.created_at AT TIME ZONE 'America/Sao_Paulo')::DATE` resolve.
- **`p_desde`/`p_ate` nulos não erram:** devolvem `recebidoPeriodo: 0` e
  `glosadoPeriodo: 0` em silêncio, com o resto do payload correto. O hook sempre
  manda string, então é só robustez — mas um zero silencioso é o pior tipo de
  resposta errada num dashboard financeiro.
- **O filtro de "títulos abertos" está escrito duas vezes**, na CTE `abertos`
  (331-336) e na subquery do aging (378-384), porque a CTE não alcança o segundo
  statement. Não é bug; é só que as duas cópias têm que mudar juntas.

## Etapa 3 — API (rotas serverless)

Revisada em 07/08/2026 contra `faturamento-titulo-criar.ts`,
`faturamento-operadoras-sync.ts`, `faturamento-lotes.ts`, `autorizacao.ts`,
`bdLab.ts`, `supabase.ts` e os três pontos de registro de rota.

### Como foi verificado

Diferente das etapas 1 e 2, aqui deu para exercitar o código **de verdade**, com
o MySQL do laboratório e o Supabase de test (eqz):

- **Rotas sem sessão**, nos dois servidores de dev que estavam no ar: `vercel dev`
  na 3000 (caminho de produção, via `api/faturamento/[action].ts`) e `vite` na
  5173 (o plugin novo). 405 no GET, 401 sem token, 404 em action inexistente e
  400 com corpo JSON quebrado — o parsing de corpo do plugin de dev funciona.
- **`bdLab` contra o MySQL real**, com os três SQLs novos empacotados por esbuild
  e rodados fora da aplicação.
- **O handler de `titulo-criar` inteiro**, empacotado com apenas o módulo de
  Supabase trocado por um stub que captura o payload. Ou seja: MySQL real,
  regra de vencimento real, validações reais.
- **O payload capturado alimentando `fat_criar_titulo`** no cluster Postgres
  descartável das etapas 1-2 — o contrato entre a etapa 3 e a etapa 2, com dados
  do lab de verdade.
- **`anotarTitulos` e `operadoras-sync` contra o Supabase de test**, semeando e
  removendo as linhas no fim (o projeto voltou às 5 operadoras de mock que já
  estavam lá).
- `npx tsc -p api/tsconfig.json --noEmit` → exit 0, sem saída.

### Verificado ✅

**Registro das rotas** — os três pontos estão de pé e batem entre si:
`ROTAS` em `api/faturamento/[action].ts`, `HANDLERS` em `api/server.ts:117-118`
e `FATURAMENTO_ACTIONS` no `vite.config.ts:622`. Testado nos dois servidores:

| chamada | vercel dev (3000) | vite (5173) |
|---|---|---|
| `GET /titulo-criar` | 405 | 405 |
| `POST /titulo-criar` sem token | 401 | 401 |
| `POST` com corpo inválido | 400 | 400 `Body inválido` |
| `POST /nao-existe` | 404 | passa adiante (404 do SPA) |

**As três consultas SQL novas existem no schema do apLIS** — era o risco que
nenhuma leitura de código resolvia. `fatlote.IdFontePagadora`,
`fatinstituicao.FontePagadora/Inativo/IdInstituicao` e o `r.Lote` no `SELECT` do
detalhe: todas respondem. `listarFontesPagadoras` devolveu **65 fontes ativas**.

**`detalharVariosLotes`** — a cirurgia de string sobre `SQL_DETALHE` (troca o
`WHERE` por `IN` e acrescenta `r.Lote` ao `SELECT`) casa com o texto real da
constante, e o agrupamento por lote está certo. Conferido guia a guia contra o
cabeçalho, numa consulta só:

| lote | guias (cabeçalho) | soma das guias (cabeçalho) |
|---|---|---|
| 6428 | 15 (15) | 3.588,65 (3.588,65) |
| 6427 | 20 (20) | 3.729,91 (3.729,91) |
| 6426 | 22 (22) | 4.407,19 (4.407,19) |

**`titulo-criar` ponta a ponta** — lotes 6427+6426 (Sul América), o payload real
entregue a `fat_criar_titulo` no cluster local:

```
nota NF-REV3 | valor_total 8137.10 | saldo 8137.10 | aberta | venc 2026-08-30
operadora    SUL AMERICA COMPANHIA DE SEGURO SAÚDE | aplis 1078
lotes        6426 (4407.19, 22) e 6427 (3729.91, 20), status_aplis 3
requisições  42, somando exatamente 8137.10, nenhuma com 'sem-guia'
vínculos     2
```

O contrato de campos entre o handler e a RPC bate um a um (`aplisId`,
`statusAplis`, `numeroRps`, `dataVencimentoRps`, `qtdRequisicoes`,
`procedimentoDescricao`…) — nenhum campo silenciosamente ignorado.

**As guardas do handler**, todas com lote real:

| entrada | resposta |
|---|---|
| lote 6471 (valor 0) | 400 `Lote(s) sem valor a faturar: 6471.` |
| lotes 6481+6476 (fontes diferentes) | 400 `Todos os lotes do título precisam ser da mesma fonte pagadora.` |
| lote 999999 | 404 `Lote(s) não encontrado(s) no apLIS: 999999.` |
| lote 6395 (tem RPS) | venc. **2026-08-28**, a do RPS |
| lote 6427 (sem RPS) | venc. **2026-08-30** = envio 31/07 + 30 dias |

**`getSupabaseUserClient`** — a premissa do arquivo (com `apikey` =
service_role e `Authorization` = JWT do usuário, quem manda é o JWT) está
**confirmada em test**, não só no código-fonte do supabase-js 2.50:

```
[user client]      current_user_has_permission('canManageUsers') = true
[service_role puro] mesma chamada                                = false
```

Ou seja, `auth.uid()` chega populado e `notas.criado_por` não vai nascer nulo.

**`anotarTitulos`** — o ponto frágil era a forma do embed do PostgREST
(`nota_lote → notas`): vem **objeto**, não array, então o cast do handler está
certo. Com um título ativo no lote 6427 e um cancelado no 6426, na mesma página:

```
6428 → null | 6427 → REV3-TMP-ATIVA | 6426 → null | 6425 → null | 6423 → null
```

O título cancelado libera o lote, como o comentário promete. O `.in()` com 200
UUIDs (o pior caso de `tamanho=200`) também foi testado direto contra o PostgREST
e passou em 222 ms — não há limite de URL escondido aí.

**`operadoras-sync` num banco limpo** — 200 OK, 65 operadoras gravadas, 54 com
CNPJ e 11 sem, `billing_sync_log` com `success / 65 / 65`. O dedupe de CNPJ deu
a coluna à primeira de cada par e `NULL` à segunda. `prazo_pagamento_dias`
realmente fica fora do UPDATE.

**Descartado após checar:** `autorizarFaturamento` não filtra
`user_profiles.deleted_at`, enquanto `current_user_has_permission` filtra. Não
vira achado: o soft delete banne o usuário no `auth` e revoga as sessões, então
`getUser(token)` já falha antes; e é o padrão de todos os outros handlers do
repo (`createUser.ts`, `documentosCheckin.ts`, `recepcaoAgendamento.ts`).

---

### 3.1 — `operadoras-sync` quebra de vez quando o CNPJ já está com a irmã

**Severidade:** média · **Status:** ✅ fechado

O handler deduplica CNPJ **dentro do lote** (`faturamento-operadoras-sync.ts:66-76`),
o que resolve o caso do primeiro sync num banco vazio — e foi exatamente o que o
teste acima mostrou funcionando. Mas a proteção depende de a linha que *recebe* o
CNPJ ser processada **antes** da que o detém hoje, e isso não está garantido.

O dado real do lab tem 3 pares de fontes pagadoras ativas com CNPJ repetido:

```
33.719.485/… -> 1009 e 1098 (CASSI-PER)
11.855.…/…   -> 1049 e 1097 (E-VIDAPER)
38.050.316/… -> 1129 e 1355 (PLAN ASSISTE MPU)
```

Reproduzido contra o Supabase de test, no cenário mais provável de todos — o
financeiro cria um título para a CASSI-PER (1098) *antes* de clicar em
sincronizar, e `fat_criar_titulo` grava a operadora **com** o CNPJ (achado 2.1).
Na sync seguinte, 1009 vem primeiro na ordem alfabética e tenta assumir o mesmo
CNPJ:

```
sync -> HTTP 500 {"success":false,"error":"Não foi possível gravar as operadoras."}
log:  status=error  duplicate key value violates unique constraint "operadoras_cnpj_key"
operadoras gravadas: 0 (das 65)
```

Não é intermitente: **todo retry falha igual** até alguém limpar o CNPJ na mão no
banco. O mesmo acontece quando a detentora do CNPJ está inativa (fora do lote,
logo fora do dedupe) — confirmado também em SQL puro no cluster local:

```
INSERT … VALUES ('B','X'),('A',NULL) ON CONFLICT (aplis_id) DO UPDATE …
ERROR:  duplicate key value violates unique constraint "op_cnpj_key"
```

**Sugestão:** é o mesmo achado 2.1 visto do outro lado — derrubar o `UNIQUE` de
`operadoras.cnpj` resolve os dois e permite apagar o dedupe do handler, que só
existe por causa da constraint. Mantendo a constraint, o handler precisaria
consultar quem detém cada CNPJ hoje e liberar antes de reatribuir, em dois
statements.

### 3.2 — Título sem vencimento não tem como ganhar um depois

**Severidade:** média · **Status:** ✅ fechado

`resolverVencimento` (`faturamento-titulo-criar.ts:67-75`) devolve `null` quando o
lote não tem RPS **nem** data de envio, e o comentário justifica: o título "fica
fora do aging até alguém preencher". Só que não existe esse alguém — nenhuma
rota e nenhum ponto do `useContasReceber` atualiza `data_vencimento`; o hook só
lê a coluna. Um título que nasce sem vencimento fica **para sempre** fora do
aging e fora do "vencido" do dashboard.

E o caminho até lá é curto: o modal de criação pede
`/api/faturamento/lotes?somenteSemTitulo=1` sem nenhum filtro de status, então
lotes ainda **"Em Processamento"** — que por definição não têm `dtaEnvio` —
aparecem para seleção. Na amostra de 200 lotes de 2026, **65 estão sem
`dtaEnvio`**. Reproduzido com o lote 6481:

```
HTTP 201 {"success":true,"valorTotal":2084.04,"dataVencimento":null}
  lote 6481: statusAplis=1 "Em Processamento" rps=null vencRps=null
```

R$ 2.084 viram um recebível invisível no aging, e ainda por cima de um lote que
sequer foi enviado à operadora.

**Sugestão:** duas frentes, e vale fazer as duas — (a) o modal só oferecer lotes
já faturados/enviados (ou marcar os demais com aviso), e (b) uma edição de
vencimento no título, que é o que o comentário do handler já pressupõe. Se
nenhuma das duas entrar agora, pelo menos o dashboard deveria contar à parte os
títulos sem vencimento, em vez de omiti-los.

### 3.3 — O snapshot do cabeçalho vem do cache; o das guias, não

**Severidade:** baixa · **Status:** ✅ fechado

`detalharVariosLotes` documenta com todas as letras que não usa cache porque "o
snapshot do título tem que ser o estado do banco agora". Mas o cabeçalho do lote
— de onde saem `valor_total`, `qtd_requisicoes` e o status — vem de
`listarLotes({ idsLote })` **sem** `ignorarCache`, e cai no cache de 3 minutos do
`bdLab`. Medido:

```
listarLotes({idsLote}): 1a=1673ms  2a=0ms   | mesmo objeto (cache): true
detalharVariosLotes:    1a=974ms   2a=961ms | mesmo objeto (cache): false
```

Consequência: dentro de uma janela de 3 min, `notas.valor_total` pode não bater
com a soma das próprias `requisicoes` que o mesmo título acabou de congelar. As
guardas de "lote sem valor" e "mesma fonte pagadora" também rodam sobre o dado
velho. O backup atrasa ~1 dia, então a chance é pequena — mas o custo de fechar
é uma palavra.

**Sugestão:** `ignorarCache: true` na chamada de `listarLotes` do
`titulo-criar` (linha 139). De quebra, para de poluir o cache com uma chave por
combinação de lotes selecionados.

### 3.4 — `somenteSemTitulo` recorta a página depois de paginar

**Severidade:** baixa · **Status:** ✅ fechado

O filtro roda em memória sobre a página já paginada (`faturamento-lotes.ts:207-209`),
e o comentário assume a escolha. O efeito colateral é que `meta` descreve a
consulta ao apLIS e não o que foi devolvido:

```
GET /lotes?...&tamanho=5&somenteSemTitulo=1
lotes devolvidos: 4 | meta.registros: 210 | meta.tamanho: 5
```

O modal pagina em cima disso, então mostra "210 lotes" e 42 páginas enquanto
entrega 4 itens na tela. Hoje é cosmético; conforme os lotes forem sendo
faturados, páginas inteiras vão chegar vazias e o operador vai concluir que
acabaram os lotes disponíveis.

**Sugestão:** o correto é filtrar antes de paginar — buscar os `aplis_id` já
faturados do período no Supabase e passá-los como `NOT IN` para o MySQL. Se for
grande demais para agora, no mínimo recalcular `meta.registros` com o que sobrou,
para a contagem parar de mentir.

### 3.5 — Nits

**Severidade:** nit · **Status:** ✅ fechado

- **`valorTotal` da resposta é soma de float.** `resultado.lotes.reduce(...)`
  (linha 254) devolveu `8137.099999999999` enquanto o banco gravou `8137.10`. O
  front ignora o campo (só olha `success`/`error`), mas ele é resposta pública da
  rota — arredondar em centavos custa nada.
- **Com RPS em datas diferentes, vence a data mais tardia.** `resolverVencimento`
  ordena e pega a última: lotes 6395 (vence 28/08) + 6385 (27/08) produzem um
  título que só entra em atraso no dia 28. Para cobrança, a mais próxima seria a
  escolha conservadora.
- **`dataEmissao` default sai em UTC.** `new Date().toISOString().slice(0,10)`
  (linha 218): título criado depois das 21h de Brasília nasce emitido no dia
  seguinte. O resto do módulo já toma o cuidado de forçar meia-noite local.
- **Corpo JSON inválido responde diferente em cada ambiente:** `Body inválido`
  no plugin do vite, `Parâmetro inválido: …` no `api/server.ts` (que engole o
  erro de parse e passa `undefined`). Cosmético, mas atrapalha quem depura em
  dev.

## Etapa 4 — Frontend

Revisada em 07/08/2026 contra `ContasReceberPage.tsx`, `ContasReceberDashboard.tsx`,
`TitulosList.tsx`, `NovoTituloModal.tsx`, `BaixaModal.tsx`, `useContasReceber.ts`,
`useContasReceberDashboard.ts`, `utils/formato.ts` e as edições em `App.tsx`,
`index.ts`, `permissions.ts`, `src/types/index.ts`, `billing/types/index.ts`.

### Como foi verificado

Seis frentes, nenhuma delas só leitura de código:

1. **Cluster Postgres descartável** (`/tmp/pgcr`, porta 5599, banco `rev4`) com
   `20260320` + as duas migrations novas, `auth.uid()` e
   `current_user_has_permission` stubadas por GUC. Nele foram reproduzidos os
   caminhos de escrita que a tela usa — `fat_criar_titulo`, `fat_registrar_baixa`,
   o `INSERT` direto de glosa do `lancarGlosas` e o `UPDATE` de status do
   `cancelarTitulo`.
2. **Contrato da RPC × tipo `DashboardReceber`**, comparando as chaves que
   `fat_dashboard_receber` realmente devolve com as que o componente consome.
3. **Supabase de test (eqz) com tokens reais de três usuários** (`generateLink` +
   `verifyOtp`, procedimento de `testar-rota-api-com-jwt-de-sessao`): um admin,
   um cargo com `canViewBilling` e um sem nada. Rodadas as queries exatas do
   `useContasReceber`.
4. **Handler real de `/api/faturamento/lotes`** (bundle esbuild da etapa 3)
   alimentando uma simulação da máquina de estados do `NovoTituloModal` com
   lotes de verdade do MySQL do laboratório.
5. **Schema de prod (jqx) via OpenAPI do PostgREST**, para saber o que a tela
   encontraria se subisse hoje.
6. `tsc` com tsconfig temporário sem `ignoreDeprecations` e `eslint` nos oito
   arquivos novos.

### Verificado ✅

**Contrato da RPC bate com o tipo.** `fat_dashboard_receber` devolve exatamente
`kpis` / `aging` / `porOperadora` / `serieMensal`, e cada subcampo casa com
`DashboardReceber`. Com dois títulos semeados (1.500 vencido há 10 dias e 2.000 a
vencer):

```
kpis   : totalReceber 3500.00 · vencido 1500.00 · qtdTitulos 2 · prazoMedioDias null
aging  : a_vencer 2000.00 · d1_30 1500.00 · resto 0
serie  : 2026-06 faturado 1500 · 2026-08 faturado 2000
porOper: UNIMED 2000 · SUL AMERICA 1500  (já ordenado por saldo desc)
```

Os números chegam como número JSON, não string — o `formatCurrency` recebe o que
espera sem precisar de coerção.

**Formato dos embeds do `useContasReceber`.** O `select` aninhado
`nota_lote(lotes(...))` foi rodado no eqz contra uma nota real: `operadoras` volta
**objeto**, `nota_lote` volta **array**, e `nota_lote[].lotes` volta **objeto**. É
exatamente a forma que `LinhaTitulo` declara e que `normalizar()` desestrutura.

**Aging cobre o título sem vencimento.** O `FILTER (WHERE atraso IS NULL OR
atraso <= 0)` colocou o título sem `data_vencimento` no bucket `a_vencer`
(2.000,00) em vez de sumir da conta — o `sub` do gráfico ("inclui títulos de
qualquer período") não mente.

**RLS × a tela, com token real de cada perfil no eqz:**

| perfil | `SELECT notas` | `fat_dashboard_receber` | seletor de operadoras | `INSERT` glosa |
|---|---|---|---|---|
| admin (`Desenvolvedor Master`) | 5 visíveis | ok, totalReceber 122.741,25 | 5 opções | permitido |
| `requester` + `canViewBilling` | 5 visíveis | ok | 5 opções | **42501 recusado** |
| `requester` sem permissão | **0 visíveis** | **42501** | **0 opções** | — |

O gate da rota (`canViewBilling`) e o da RLS concordam, e o usuário sem permissão
não vaza um único título. O `podeEditar` da página e a RLS de escrita também
concordam: quem não tem `canManageBilling` não consegue gravar nem pelo console.

**Glosa avulsa funciona pelo caminho que o hook escolheu.** O `INSERT` direto em
`glosas` com `recebimento_id = NULL` (o `lancarGlosas`, sem RPC) foi aceito e a
trigger recalculou o título: 2.000,00 → glosado 300,00, saldo 1.700,00, status
`aberta`. Subindo a glosa para `definitiva` de 2.000,00, o título virou
`liquidada` com saldo 0 — é o que o rodapé do modal promete ao operador
("glosa definitiva encerra o saldo correspondente").

**Título cancelado recusa baixa.** Com `cancelarTitulo` aplicado, uma chamada
posterior a `fat_registrar_baixa` morre em `Título cancelado não aceita baixa.` —
os botões desabilitados da lista têm respaldo no banco, não são só cosmética.

**`formato.ts` resolve a duplicação que o plano apontou.** `FaturasDashboard`
perdeu as duas cópias locais e passou a importar do utilitário; `formatData` e
`hojeIso` forçam meia-noite local, e `diasDeAtraso` calcula os dois lados em UTC
para não sofrer com horário de verão.

**Qualidade estática.** `tsc` sem `ignoreDeprecations` fecha com **zero erros nos
arquivos da etapa 4** — os 26 restantes são os pré-existentes de
MindMap/Quotation (`flowlab-typecheck-ignoredeprecations`). `eslint` nos oito
arquivos novos: limpo, incluindo as regras de `react-hooks` (os dois
`eslint-disable` presentes são os guards de race condition intencionais,
idênticos aos de `useFaturamentoLotes`).

**Guards de race condition e debounce.** `buscaAtual = useRef(0)` está nos dois
hooks, com invalidação no unmount; as deps do `useCallback` são as primitivas
desestruturadas, não o objeto de filtros. Os dois debounces (350 ms) resetam
`pagina: 1`, então não existe o estado "página 4 de um resultado de 1 página".

**Descartado após checar:** cogitei que `cancelarTitulo` (um `UPDATE` direto em
`notas.status`, sem RPC) pudesse ser desfeito pela trigger no próximo
recálculo — não é: `fat_recalcular_nota` lê `status = 'cancelada'` e o preserva
como ramo de maior precedência do `CASE`. Verificado no cluster.

---

### 4.1 — A seleção de lotes sobrevive à troca de filtro e entra no título invisível

**Severidade:** alta · **Status:** ✅ fechado

`NovoTituloModal` guarda a seleção em `selecionados: Set<number>` (linha 45), que
**não é limpo quando a lista recarrega** — trocar o período ou digitar na busca
dispara `carregar()` e substitui `lotes`, mas o `Set` continua intacto.

A partir daí a tela e o envio divergem, porque olham para coisas diferentes:

- `marcados` (linha 117) é `lotes.filter(...)` — **só o que está visível agora**.
  É o que alimenta `totalSelecionado` e o guard `misturouFontes`.
- `submeter()` (linha 147) envia `idsLote: [...selecionados]` — **o Set inteiro**.

Reproduzido com lotes reais do apLIS, rodando o handler de verdade por trás:

```
marcou o lote 6191 (junho, SUL AMERICA, R$ 796,43)
  a tela diz : "1 lotes · R$ 796,43"      submeter(): [6191]

trocou para julho e marcou o lote 6427 (SUL AMERICA, R$ 3.729,91)
  a tela diz : "2 lotes · R$ 3.729,91"    submeter(): [6191, 6427]

  soma real dos dois lotes: R$ 4.526,34
```

O operador confere R$ 3.729,91 no resumo, clica em criar, e nasce um título de
R$ 4.526,34 — com um lote que ele não vê na tela e que já não lembra ter marcado.
O `valor_total` do título sai da soma dos snapshots dentro da RPC, então o banco
fica coerente consigo mesmo; quem mente é a confirmação que o operador leu.

Pior no caso das fontes pagadoras: `misturouFontes` só enxerga os `marcados`, então
um lote escondido de outra operadora passa pelo guard da tela e só é barrado pelo
400 da rota — com o formulário inteiro preenchido e a mensagem genérica de
"todos os lotes precisam ser da mesma fonte pagadora", sem dizer qual lote.

Duas saídas, e a segunda parece a certa: limpar `selecionados` dentro de
`carregar()`, ou guardar os objetos `LoteFaturamento` selecionados (não só os ids)
para que resumo, guard e envio leiam a mesma lista.

---

### 4.2 — O modal de criação só alcança 50 lotes e não tem paginação

**Severidade:** média · **Status:** ✅ fechado

`TAMANHO_PAGINA = 50` (linha 14) e o `URLSearchParams` de `carregar()` (linha 80)
nunca manda `pagina`. Não há botão de próxima página em lugar nenhum do modal.

Medido chamando o handler real:

```
período padrão do modal (mês corrente): devolvidos 43 | meta.registros 43
período de um ano                     : devolvidos 50 | meta.registros 1427
```

No mês corrente cabe tudo, e é por isso que passa despercebido. Basta o operador
alargar o período — que é exatamente o que ele faz para achar um lote antigo
ainda não faturado — para 1.377 lotes ficarem inalcançáveis, sem nenhum aviso de
que a lista foi cortada.

Isso compõe com [3.4](#34--somentesemtitulo-recorta-a-página-depois-de-paginar):
como `somenteSemTitulo` recorta *depois* de paginar, o `meta.registros` que uma
eventual paginação usaria também está errado. Consertar os dois juntos: mover o
filtro para antes do recorte na rota e dar navegação de página ao modal.

---

### 4.3 — A tela ainda tem bloqueios de ambiente

**Severidade:** média · **Status:** ⚪ checklist de deploy, sem código a mudar

São dois problemas distintos, um por ambiente, e nenhum deles é de código:

**test (eqz) — as migrations estão aplicadas e existe um cargo com a permissão.**
Confirmado varrendo os cargos e os perfis do eqz:

```
cargos           : 7   (Médico, Desenvolvedor, Solicitante, Operador,
                         analistaSaude, Administrador, Desenvolvedor Master)
com canViewBilling  : 3 cargos  ·  9 perfis
com canManageBilling: 1 cargo   ·  4 perfis explícitos
role legada admin   : 6 perfis  ·  permissão efetiva no banco
```

Como `podeEditar` é `hasPermission(userProfile.permissions, 'canManageBilling')` e
`AuthContext` monta `permissions` a partir de `custom_roles.permissions` (linha
69-70), os 4 perfis associados ao `Desenvolvedor Master` abrem a tela com as
ações de escrita. Os 4 admins associados ao cargo `Administrador` continuam em
modo somente leitura no frontend, apesar de o banco aceitar as operações deles
pelo ramo `role = 'admin'`.

Vale notar a assimetria com o banco: no Postgres, `current_user_has_permission`
devolve `true` para qualquer `role = 'admin'` independente do cargo, e o admin do
eqz de fato conseguiu inserir uma glosa pelo token. Ou seja, o front continua
mais restritivo que a RLS para os admins sem `canManageBilling` no cargo custom.
Isso é o padrão do repositório
(`EstoqueDepartamental.tsx:259` faz igual) e não é defeito da etapa 4 — mas
significa que os cargos que devem operar a tela precisam receber a permissão no
frontend; não dá para contar apenas com o atalho do admin para a experiência da
tela.

**prod (jqx) — as migrations não estão aplicadas.** Verificado pelo OpenAPI do
PostgREST: `notas.valor_saldo` não existe, `notas.criado_por` não existe,
`lotes.status_aplis` não existe, `glosas.lote_id` não existe, e nenhuma RPC
`fat_*` está registrada. Rodando as duas chamadas da tela contra prod:

```
GET  /notas?select=…,valor_saldo   → 400  column notas.valor_saldo does not exist
POST /rpc/fat_dashboard_receber    → 404  PGRST202 (função não encontrada)
```

Ou seja: se o frontend subir antes das migrations, as duas abas quebram na
abertura — a de Títulos com um erro de coluna em vermelho e a de Dashboard com o
`error` do hook. Ordem de deploy: migrations em jqx → conferir/atribuir
`canManageBilling` ao cargo que operará a tela em cada projeto (o eqz já tem
`Desenvolvedor Master`) → só então o frontend.

---

### 4.4 — Baixa maior que o saldo é aceita e deixa o título com saldo negativo

**Severidade:** média · **Status:** ✅ fechado

O `BaixaModal` calcula `restante = saldo - recebido - totalGlosas` e pinta o
número de vermelho quando fica negativo (linha 249) — mas **isso é tudo**. O
botão "Registrar baixa" só desabilita em `salvando` (linha 393), as validações do
`submeter` (linhas 123-138) checam motivo e valor das glosas e nada mais, e
`fat_registrar_baixa` só recusa `valor <= 0` sem glosas.

No cluster, um título de R$ 1.500,00 recebendo uma baixa de R$ 2.500,00:

```
aceitou: t
NF-A | valor_total 1500.00 | valor_recebido 2500.00 | valor_saldo -1000.00 | status recebida
```

O saldo negativo contamina o dashboard: o título sai do aging (o `WHERE
valor_saldo > 0` o exclui) mas os R$ 2.500,00 continuam somando em
`recebidoPeriodo`, então "recebido no período" passa a valer mais do que jamais
foi faturado. E como `valor_saldo` é coluna gerada, não há como corrigir sem
estornar a baixa.

Um erro de digitação (2500 em vez de 250,00) é o caminho óbvio para isso. Uma
confirmação — ou o botão desabilitado enquanto `restante < 0`, com a mensagem
dizendo o quanto excede — resolveria no lugar mais barato. Pagamento a maior
existe de verdade, mas aí é decisão consciente, não um clique distraído.

---

### 4.5 — A aba Dashboard não tem controle nenhum

**Severidade:** baixa · **Status:** ✅ fechado

`ContasReceberDashboard` recebe `desde`, `ate` e `operadoraId` de `filtros`
(`ContasReceberPage.tsx:186-190`), mas os campos que editam esse estado moram
dentro do `TitulosList`, que só é renderizado na aba Títulos.

Resultado: o dashboard abre travado em "últimos 3 meses, todas as operadoras" e,
para trocar o período, o operador precisa ir à aba Títulos, mudar o filtro lá, e
voltar. Nada indica que os dois estão ligados — o subtítulo do gráfico diz "no
período filtrado" sem que exista um filtro à vista.

Subir a barra de período/operadora para a `ContasReceberPage`, acima das abas,
resolve e ainda deixa explícito que o recorte vale para as duas.

---

### 4.6 — "Glosas e Recursos" agora falha em silêncio

**Severidade:** baixa · **Status:** ✅ fechado — sintoma novo de [1.1](#11--usebillingupdateglosastatus-contradiz-a-trigger-nova)

`GlosasRecursos.tsx` ficou fora do reescopo e continua roteada em
`App.tsx:256`, montada sobre `useBilling`. Com a RLS nova ela ganhou um modo de
falha que não existia: o `UPDATE` em `glosas` **não dá erro, apenas não afeta
linha nenhuma** (a policy filtra pelo `USING`), e `updateGlosaStatus` devolve
`{ success: true }`.

Medido no eqz com o token de um cargo que tem `canViewBilling` mas não
`canManageBilling`:

```
SELECT glosa (a tela lista)  : 1 linha
UPDATE glosa (botão Recurso) : 0 linhas afetadas, SEM erro
```

O operador clica em "Abrir recurso", a tela recarrega, e a glosa continua
`aberta`. Nenhuma mensagem, nenhum log. Some junto com o achado 1.1 quando o
destino dessa tela for decidido; enquanto ela existir, no mínimo precisa do mesmo
gate `podeEditar` que a `ContasReceberPage` tem (os botões das linhas 348-372 não
checam permissão nenhuma).

---

### 4.7 — `tituloId`/`tituloNumero` nunca chega à aba Faturas

**Severidade:** baixa · **Status:** ✅ fechado

O plano pedia que o enriquecimento servisse ao modal de criação **e** à aba
Faturas, "que passa a mostrar 'já está no título X'" (etapa 3.2). O campo foi
adicionado ao tipo `LoteFaturamento` e o servidor o preenche, mas
`grep tituloId src/modules/faturamento/**` só encontra a definição do tipo:
`FaturasDashboard.tsx` não lê nem exibe.

O custo do enriquecimento (uma consulta Supabase por página) já está sendo pago
naquela aba. É meia hora de trabalho para entregar o item do plano, ou uma decisão
explícita de cortá-lo.

---

### 4.8 — Erro ao carregar guias é exibido como "nenhuma guia"

**Severidade:** baixa · **Status:** ✅ fechado

`buscarGuias` (`useContasReceber.ts:208`) faz `throw` quando o Supabase devolve
erro. Em `BaixaModal.carregarGuias` isso é capturado e vira mensagem. Em
`TitulosList.abrirLote` (linha 129-135) o `try` tem **só `finally`, sem `catch`**:

```ts
setCarregandoGuias(true);
try {
  const lista = await buscarGuias(loteId);
  setGuias((atual) => ({ ...atual, [loteId]: lista ?? [] }));
} finally {
  setCarregandoGuias(false);
}
```

A rejeição escapa como *unhandled promise rejection* (o chamador é `void
abrirLote(...)`), `guias[lote.id]` fica `undefined`, e o `else if` da linha 371
renderiza **"Nenhuma guia congelada para este lote."**. Uma falha de rede ou de
RLS aparece para o operador como um lote legitimamente vazio — que é justamente a
conclusão errada na hora de conferir uma glosa.

Um `catch` que guarde a mensagem por lote resolve, no molde do que o `BaixaModal`
já faz.

---

### 4.9 — Nits

**Severidade:** nit · **Status:** ✅ fechado

- **Sincronizar operadoras não atualiza o seletor.** `sincronizarOperadoras`
  chama `refetch()`, que recarrega os títulos; a lista de operadoras do filtro
  vem de um `useEffect` com deps `[]` (`useContasReceber.ts:189-200`) e só roda na
  montagem. Depois de importar 65 fontes pagadoras do apLIS, o `select` continua
  mostrando as antigas até um F5.
- **Erro de sincronização aparece em azul.** O estado `aviso` serve para sucesso e
  para falha, sempre com o card azul de informação
  (`ContasReceberPage.tsx:158-163`). "Falha ao sincronizar operadoras" com cara de
  aviso positivo.
- **Dois "hoje" diferentes no atraso.** O badge da lista usa `diasDeAtraso`, que
  compara com `hojeIso()` (data **local**); o aging da RPC compara com
  `CURRENT_DATE` (data do **servidor**, UTC). Depois das 21h de Brasília os dois
  discordam por um dia: a linha diz "vence em 1d" e o mesmo título já entrou no
  bucket `d1_30` do gráfico.
- **`fechar()` não reseta período nem emissão.** Limpa seleção, número, competência,
  vencimento e observações (linhas 62-70), mas `periodoIni`/`periodoFim`/
  `dataEmissao` ficam como estavam. Inofensivo hoje, mas é a mesma classe de
  problema do 4.1 — meia limpeza.
- **Fonte pagadora nula colapsa em `0`.** `new Set(marcados.map((l) => l.fontePagadora.id ?? 0))`
  (linha 125) trata dois lotes sem fonte identificada como sendo da mesma
  operadora. A rota barra depois, mas o aviso da tela não aparece.
- **`carregandoGuias` é um booleano só para todos os lotes.** Abrir um segundo lote
  enquanto o primeiro carrega pisca "Carregando guias…" no lugar errado.
- **Tipo de retorno divergente.** O hook declara
  `buscarGuias: (loteId) => Promise<TituloGuia[] | undefined>` (via
  `TituloReceber['lotes'][number]['guias']`) mas a implementação sempre devolve
  array. Os dois consumidores carregam um `?? []` defensivo por causa disso.

---

## Fechamento — achados de baixa severidade e nits (10/08/2026)

Implementados sobre o que `66d33f5`/`a2e8475` já tinham fechado (alta/média).
Migration nova: `20260810140000_revisao_contas_receber_baixa_severidade.sql`
(`CREATE OR REPLACE` de `fat_criar_titulo`, `fat_registrar_baixa` e
`fat_dashboard_receber`, mais os `DROP/CREATE INDEX` do 1.2 e o `COMMENT` do
1.3). Lado API: `ignorarCache` no `listarLotes` do `titulo-criar` (3.3),
arredondamento/RPS mais próximo/emissão em horário local (3.5), e
`meta.filtrados` em `faturamento-lotes.ts` (3.4). Lado frontend: aviso de lote
sem envio no `NovoTituloModal` (3.2), badge de título já vinculado no
`FaturasDashboard` (4.7), `catch` de erro ao carregar guias no `TitulosList`
(4.8), e os sete nits do 4.9 (`useContasReceber.ts`, `ContasReceberPage.tsx`,
`NovoTituloModal.tsx`, `TitulosList.tsx`, `BaixaModal.tsx`).

**3.4** ficou mitigado, não resolvido por completo: filtrar antes de paginar
exigiria excluir os `aplis_id` já faturados dentro da própria consulta ao
MySQL, o que colide com o cache de 3min do `bdLab` (mesmo cache que o 3.3
corrigiu para o caminho de criação de título). `meta.filtrados` agora diz
quantos itens da página foram ocultados, para o modal não anunciar mais lotes
utilizáveis do que existem — mas `meta.registros`/`qtdPaginas` continuam
descrevendo a consulta ao apLIS sem o filtro.

**Validação:** `npx tsc -p api/tsconfig.json --noEmit` e `npx tsc --noEmit`
(zero erros novos; os pré-existentes de MindMap/Quotation continuam os
mesmos) e `eslint` nos onze arquivos tocados, ambos limpos. **A verificação
num cluster Postgres descartável — o método usado nas quatro etapas
anteriores — não foi possível nesta rodada** (permissão negada para subir o
processo `pg_ctl` no ambiente da sessão); a migration nova foi revisada à mão
contra o schema e os padrões das migrations já testadas (mesmos nomes de
coluna, mesmo idioma de `COALESCE`/`NULLIF`, mesma ordem de guardas), mas
**ainda não foi exercitada rodando de verdade** — vale a pena alguém aplicar a
cadeia completa e repetir o roteiro de casos antes de subir para o eqz.
