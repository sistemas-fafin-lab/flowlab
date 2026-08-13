# Oportunidades de melhoria arquitetural — segunda rodada

Segunda revisão de arquitetura, ainda focada nos módulos mais mexidos do
histórico recente (`faturamento` e `analises-clinicas` — os dois únicos com
mais de 20 commits nas últimas semanas), usando o mesmo vocabulário de
[`/codebase-design`](../../CLAUDE.md) da primeira rodada: **módulo**,
**interface**, **profundidade**, **seam**, **adapter**, **leverage**,
**localidade**, e o **teste de deleção**.

A primeira rodada (`docs/architecture/oportunidades-melhoria-arquitetura.md`,
commit `4ddad94`) apontou três candidatos — A, B e C. 31 commits depois:

- **Candidato A** foi parcialmente resolvido — `useBilling` foi removido, mas
  o módulo de tipos que ele deveria devolver a `faturamento/`
  (`billing/types`) virou o padrão de fato, com 19 importadores. Ver
  Candidato 4 abaixo, que fecha o que sobrou.
- **Candidato B** e **Candidato C** continuam sem endereçar, e B piorou (ver
  Candidato 3 abaixo).

Os candidatos abaixo cobrem o estado atual.

> ✅ **Candidato 2 e Candidato 4 foram resolvidos** em `d63e091`/`45a0fe4`
> (commits posteriores a esta revisão); Candidato 1 já estava em `39697a1`.
> Resta o Candidato 3 — e vale fazer junto o Candidato C da primeira rodada
> (unificar `chamarApoioApi` nos hooks de agendamento/correção), que toca a
> mesma pasta.

---

## Candidato 1 — O esqueleto do hook "legado" foi copiado quatro vezes, de olhos abertos

**Força: 🔴 Strong** · local-substitutable

> ✅ **Resolvido em `39697a1`** ("refactor(faturamento): extrai adapter
> comum dos hooks legado"), commit posterior a esta revisão.

**Arquivos:**
- `src/modules/faturamento/hooks/useFaturamentoLotes.ts` (164)
- `src/modules/faturamento/hooks/useGlosasLegado.ts` (112)
- `src/modules/faturamento/hooks/useRecursosLegado.ts` (140)
- `src/modules/faturamento/hooks/useImagensRequisicaoLegado.ts` (110)
- `src/modules/faturamento/components/FaturasDashboard.tsx`,
  `HistoricoGlosasLegado.tsx` (range/`dayKey` duplicados)

### Problema

O comentário no topo de `useRecursosLegado.ts:10-12` dizia "mesmo esqueleto
de useFaturamentoLotes/useGlosasLegado" — a duplicação foi copiada sabendo
que era duplicação. Os quatro hooks repetiam, quase byte a byte:
`getToken()` (7 cópias no repo, contando 2 em `analises-clinicas`), um
`cacheSessao = new Map()` em module scope, uma guarda de corrida via
`buscaAtual` ref, e a mesma função `consultar()` com
`!res.ok || !body.success`. Em paralelo, a regra "preset de período → range
ISO" (`dayKey`, fuso, "mês = dia 1 até hoje") estava copiada verbatim entre
`FaturasDashboard.tsx:101-121` e `HistoricoGlosasLegado.tsx:45-63`.

**Teste de deleção:** apagar o bloco cache/guarda-de-corrida/`getToken`/
`consultar` de qualquer um dos quatro hooks fazia a mesma complexidade
reaparecer nos outros três — não era indireção sobrando, era a ausência de
um adapter genérico. O módulo `analises-clinicas` já tinha resolvido
exatamente este problema para as chamadas ao LAB-HUB com `chamarApoioApi`
em `apoioApi.ts` — o padrão certo já existia no repo, só não em
`faturamento`.

### Solução (implementada)

`useLegadoListagem<TItem, TFiltros>(rota, chaveDeCache)` extraído com o
esqueleto genérico (`hooks/legado/useLegadoListagem.ts`,
`hooks/legado/api.ts`); os quatro hooks viraram chamadores finos que só
descrevem rota e tipo. `janelaDoPreset(preset)` extraído para o
range/`dayKey` em `utils/periodo.ts`, com a primeira suíte de testes
(vitest) do repositório.

### Benefícios

- **Localidade**: um bug de contrato de erro do legado (parse de `success`)
  passa a se corrigir uma vez.
- **Leverage**: o próximo hook legado (a área ainda está crescendo) herda o
  adapter em vez de copiar.
- **Interface encolhe**: quatro esqueletos idênticos viraram quatro linhas
  de config.

---

## Candidato 2 — Views salvas: o seam devolve dados crus, cada tela monta sua própria defesa

**Força: 🔴 Strong** · in-process

> ✅ **Resolvido em `d63e091`** ("refactor(faturamento): sanitizar filtros de
> views salvas no seam"), commit posterior a esta revisão. `useViewsSalvas`
> agora exige um `sanitizar` por tela (`utils/viewsSalvas.ts`, com suíte
> vitest) e nunca devolve filtro cru; as três defesas locais foram removidas.

**Arquivos:**
- `src/modules/faturamento/hooks/useViewsSalvas.ts:20,30` (`filtros: unknown → as TFiltros`)
- `src/modules/faturamento/components/FiltrosReceber.tsx`, `TitulosList.tsx`, `GlosasRecursos.tsx`

### Problema

O commit `3b971eb` ("aplicar view salva não crasha mais em formato
incompleto") corrigiu um crash real — mas em três lugares, de três formas
diferentes: merge com `padrao` em `FiltrosReceber`, fallback campo a campo
com `??` em `TitulosList`, validação contra um `Set` em `GlosasRecursos`. O
seam que devia garantir isso — `useViewsSalvas` — só faz
`filtros: linha.filtros as TFiltros` (linha 30): um cast sem validação de
uma coluna JSONB.

**Teste de deleção:** apagar qualquer uma das três defesas reintroduz o
crash/bug de `3b971eb` — só naquela tela. O módulo não impõe a garantia;
cada chamador tem que lembrar de reinventá-la.

### Solução

Mover a sanitização para dentro de `useViewsSalvas` (ou de
`ViewsSalvasMenu`, que já sabe a forma de `TFiltros` de cada tela) para que
o hook nunca devolva um filtro capaz de crashar um consumidor.

```
ANTES                                      DEPOIS
useViewsSalvas                             useViewsSalvas
 └─ filtros as TFiltros (sem validar)        └─ sanitizar(filtros, padrao)
      │                                           → sempre TFiltros seguro
      ├─ FiltrosReceber: merge c/ padrao               │
      ├─ TitulosList: fallback ?? campo a campo        ├─ FiltrosReceber: só consome
      └─ GlosasRecursos: Set de status válidos         ├─ TitulosList: só consome
   3 defesas diferentes p/ o mesmo problema             └─ GlosasRecursos: só consome
```

### Benefícios

- **Locality**: bug de formato incompleto corrige-se uma vez, não em N
  telas.
- **Leverage**: o próximo consumidor de views salvas (o padrão já tem 3
  usos) herda a garantia de graça.
- Interface do seam passa a carregar a garantia que hoje mora nos
  chamadores.

---

## Candidato 3 — As regras de agendamento continuam morando na tela, e a tela já passou de 2000 linhas

**Força: 🔴 Strong** · carried over — piorou desde a primeira rodada (era o Candidato B)

**Arquivos:**
- `src/modules/analises-clinicas/components/AgendamentosPage.tsx` (2053 linhas, era 1745)
- `src/modules/analises-clinicas/hooks/useAgendamentos.ts` (253 linhas — CRUD raso)
- `CulturasPage.tsx`, `LaudosPage.tsx`, `RecoletasPage.tsx` (`statusLabel` x3)
- `PostosPage.tsx` / `IndicadoresPage.tsx` (janela de data x4)

### Problema

As três duplicações já documentadas na primeira rodada continuam idênticas:
`hojeISO`/`rotuloDiaPassado` só em `AgendamentosPage.tsx:132,144`; a janela
`T00:00:00`/`T23:59:59.999` repetida em quatro arquivos; `statusLabel`
reimplementado três vezes, com `LaudosPage.tsx:705,707` ainda comparando
strings soltas (`'aguarda_liberacao'`) em vez do enum `STATUS_LAUDO`. O
commit `7b93aef` (editar agendamento) não tocou essas linhas — mas
acrescentou mais 314 linhas de regra nova (disponibilidade/slots do
`EditarAgendamentoModal`) direto na página, em vez de no hook.
`useAgendamentos.ts` continua sem saber o que é "retroativo" ou "editável".

**Teste de deleção:** apagar qualquer cópia da matemática de data ou do
status label faz a complexidade reaparecer nas outras três — falta um
módulo, não sobra indireção. Apagar a regra de retroativo de
`AgendamentosPage` não faz a regra sumir do sistema, ela reaparece na
próxima tela que precisar da mesma pergunta.

### Solução

Um módulo `analises-clinicas/domain/` com `parseDataLocal`/`janelaDoDia` e
`rotuloStatus(enum, valor)` genérico; a regra de retroativo/editável sai da
JSX e entra em `useAgendamentos.ts` como função pura exportada. Dado o
tamanho (8 componentes de 800+ linhas dependem da forma escolhida), vale
uma rodada de `/codebase-design` ("design it twice") antes de mexer.

```
                              1745 linhas   2053 linhas
                             (rodada 1)      (hoje)
regras fora do hook           ██████         ██████████
                                                  ▲ +314 linhas de regra nova
                                                    (disponibilidade/slots),
                                                    direto na página
```

### Benefícios

- **Locality**: bug de fuso-horário corrige-se uma vez, não caçado em
  quatro arquivos.
- **Testabilidade**: regras viram funções puras, sem montar 2053 linhas de
  JSX.
- **Leverage**: cresce a cada tela nova de `analises-clinicas` — é o módulo
  que mais recebe commits.

---

## Candidato 4 — `billing/types` é o módulo de tipos de fato do faturamento — só que mora fora dele

**Força: 🟡 Worth exploring** · fecha o Candidato A da primeira rodada

> ✅ **Resolvido em `45a0fe4`** ("refactor(faturamento): mover billing/types
> para faturamento/types"), commit posterior a esta revisão. Tipos movidos
> para `faturamento/types`, 19 imports ajustados e a pasta `modules/billing/`
> aposentada — o Candidato A da primeira rodada fechou por completo.

**Arquivos:**
- `src/modules/billing/types/index.ts` (462 linhas)
- 19 arquivos importadores em `src/modules/faturamento/`

### Problema

O Candidato A da primeira rodada propunha aposentar `useBilling` e fundir
tudo em `faturamento`. A primeira metade aconteceu — `useBilling.ts` não
existe mais. Mas os tipos que ele carregava (`billing/types/index.ts`) não
voltaram para `faturamento/`: viraram a base de tipos de todo trabalho
novo, com 19 arquivos importando de lá — inclusive os quatro hooks legado
do Candidato 1 e o `useViewsSalvas` do Candidato 2. `faturamento/` não tem
`types/` nem barrel próprio.

**Teste de deleção:** apagar `billing/types` sem mover nada quebra 19
arquivos ao mesmo tempo — não é indireção sobrando, é módulo real,
mal-localizado. Sem bug documentado, é fricção de descoberta: `billing/`
não corresponde a nenhum conceito de domínio ativo desde que `useBilling`
saiu.

### Solução

Mover `billing/types` para `faturamento/types` e ajustar os 19 imports;
aposentar a pasta `modules/billing/` inteira.

### Benefícios

- **Locality**: quem procura tipos de faturamento olha dentro de
  faturamento.
- Fecha o Candidato A da primeira rodada por completo, não só a metade do
  hook.

---

## Recomendação principal

**Candidato 1 já foi feito** (commit `39697a1`) — era o único com uma
confissão do próprio autor no código ("mesmo esqueleto de…") e o de maior
leverage futuro, já que `faturamento` continua ganhando integrações com o
backup MySQL.

**Candidato 2 e Candidato 4 foram fechados** em `d63e091`/`45a0fe4` — com
eles, a pauta do `faturamento` desta rodada zerou.

O que resta é o **Candidato 3** (regras de agendamento): o maior leverage de
longo prazo — é o módulo que mais cresce — mas pede uma rodada de
`/codebase-design` antes, porque oito telas de 800+ linhas dependem da forma
escolhida para `domain/`. Junto dele, o Candidato C da primeira rodada
(`getToken`/`buscarPacientes` duplicados e o adapter `chamarApoioApi` não
adotado) pode ser feito como sub-tarefa, já que toca os mesmos hooks.
