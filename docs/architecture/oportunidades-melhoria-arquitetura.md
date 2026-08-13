# Oportunidades de melhoria arquitetural

Revisão de arquitetura focada nos módulos mais ativos do histórico recente
(`faturamento` e `analises-clinicas` — 20+ dos últimos 50 commits), usando o
vocabulário de [`/codebase-design`](../../CLAUDE.md): **módulo**, **interface**,
**profundidade**, **seam**, **adapter**, **leverage**, **localidade**, e o
**teste de deleção** ("se eu apagar isto, a complexidade some ou reaparece em
cada chamador?").

Não há `CONTEXT.md` nem `docs/adr/` neste repositório ainda — as sugestões
abaixo não conflitam com nenhuma decisão registrada, mas também não têm uma
linguagem de domínio prévia para se apoiar. Se alguma virar trabalho real, vale
nomear os conceitos novos (`Título a Receber`, `Agendamento retroativo`, etc.)
em um `CONTEXT.md`.

---

## Candidato A — Contas a Receber tem dois donos

**Força: 🔴 Strong**

**Arquivos:**
- `src/hooks/useBilling.ts` (372 linhas)
- `src/modules/faturamento/components/GlosasRecursos.tsx` (478 linhas)
- `src/modules/faturamento/hooks/useContasReceber.ts` (351 linhas) — o módulo bom
- `src/modules/billing/types/index.ts` (tipos legados que só `useBilling` ainda usa)

### Problema

O domínio "Título a Receber" tem duas implementações vivas ao mesmo tempo,
sem que nenhuma saiba da outra:

- **`useContasReceber`** é a interface nova: leitura via `select` tipado do
  Postgres, escrita via as RPCs `fat_criar_titulo` / `fat_registrar_baixa` —
  que existem justamente porque "uma baixa e as glosas que a explicam
  precisam entrar na mesma transação, senão o saldo do título fica mentindo
  entre um statement e outro" (comentário do próprio arquivo, linha 21-23).
  A lógica de cálculo do saldo mora numa trigger Postgres única
  (`update_nota_valores`), testada exaustivamente em
  `docs/plans/faturamento/revisao-contas-receber.md`.
- **`useBilling`**, consumido só por `GlosasRecursos`, é a implementação
  antiga: `fetch`/`update` direto nas tabelas `recebimentos` e `glosas`, com
  sua própria cópia de `formatCurrency` (linha 336-341, já existe em
  `utils/formato.ts`) e sua própria modelagem de "o que é uma glosa".

O **achado 1.1** da revisão (fechado em `66d33f5`) mostra exatamente o custo
disso: `updateGlosaStatus` somava o valor da glosa revertida em
`recebimentos.valor_recebido` — contagem duplicada, na direção errada —
porque o hook carregava uma definição de `revertida` diferente da que a
trigger nova já implementava. O bug só foi pego porque alguém revisou os dois
lados à mão; nada na arquitetura teria impedido a próxima pessoa de reabrir o
mesmo problema em outro canto do hook.

**Teste de deleção:** apagar `useBilling` não faz a complexidade
desaparecer — mas também não a espalha por N chamadores, porque só há **um**
chamador (`GlosasRecursos`). Ela reaparece uma vez só, dentro do próprio
componente, na forma de "preciso buscar glosas e atualizar status usando a
interface que já existe". Ou seja: o teste aponta para fusão, não para
justificar a existência do hook. Hoje `useBilling` expõe 10 membros; `GlosasRecursos`
usa 6 (`glosas`, `fetchGlosas`, `updateGlosaStatus`, `loading`, `error`,
`clearError`) e ignora `formatCurrency` só porque reimplementa o mesmo cálculo
— **40% da interface é superfície morta** (`recebimentos`,
`fetchRecebimentos`, `fetchRecebimentosAgrupados`, `registerRecebimento`
nunca são chamados por ninguém).

### Solução

Aposentar `useBilling` e `src/modules/billing/` inteiros. Reescrever
`GlosasRecursos` sobre `useContasReceber` (ou um hook irmão no mesmo módulo,
com a mesma disciplina de RPC): listar glosas a partir de `titulos[].lotes`/
uma extensão da mesma query, e trocar `updateGlosaStatus` por uma chamada que
passe pela trigger — hoje isso já é possível com um `UPDATE` direto em
`glosas.status` (o `lancarGlosas` do `useContasReceber` mostra que updates de
uma linha não precisam de RPC), só que dentro do módulo novo, com o mesmo
tipo `TituloGuia`/`TituloReceber` e sem a cópia de `formatCurrency`.

Isso é exatamente a opção 1 que o próprio achado 1.1 já cogitou ("reescrever
`GlosasRecursos` sobre as RPCs novas e aposentar o `useBilling`") e descartou
por escopo — mas o escopo da entrega original já fechou, e o débito continua
ali.

### Benefícios

- **Localidade**: hoje uma mudança na regra de saldo (ex.: o que "glosa
  revertida" significa) precisa ser feita — e lembrada — em dois lugares: a
  trigger SQL e qualquer lógica de cliente que a contorne. Depois da fusão,
  só a trigger decide, e todo cliente lê o resultado dela.
- **Leverage**: os testes rigorosos que já existem para `fat_registrar_baixa`
  e a trigger (roteiro de 20 casos, três perfis de RLS, corrida de duas
  sessões) passam a cobrir também o caminho de glosas avulsas, sem precisar
  de uma segunda bateria de testes para `useBilling`.
- Remove ~370 linhas e um módulo de tipos inteiro (`billing/types`) que só
  serve a um único componente.

### Antes / Depois

```
ANTES                                    DEPOIS
┌─────────────────────┐                  ┌─────────────────────┐
│ useContasReceber     │                  │ useContasReceber     │
│ (RPC fat_*, trigger) │                  │ (RPC fat_*, trigger) │
│  ├─ ContasReceberPage│                  │  ├─ ContasReceberPage│
│  ├─ BaixaModal       │                  │  ├─ BaixaModal       │
│  └─ NovoTituloModal  │                  │  ├─ NovoTituloModal  │
└─────────────────────┘                  │  └─ GlosasRecursos   │
                                          └─────────────────────┘
┌─────────────────────┐                  (useBilling e billing/types
│ useBilling            │                   removidos)
│ (CRUD direto, 40%     │
│  de superfície morta)│
│  └─ GlosasRecursos    │
└─────────────────────┘
   dois modelos de "saldo do título",
   um bug de dupla contagem já achado
```

---

## Candidato B — As regras de análises clínicas moram nas telas, não em um módulo

**Força: 🔴 Strong**

**Arquivos:**
- `src/modules/analises-clinicas/components/AgendamentosPage.tsx` (1745 linhas)
- `src/modules/analises-clinicas/components/EnvioApoioPage.tsx` (1450 linhas)
- `src/modules/analises-clinicas/components/TemperaturaEquipamentosPage.tsx` (1319 linhas)
- `.../PainelColetasPage.tsx` (1108), `.../LaudosPage.tsx` (943),
  `.../IndicadoresPage.tsx` (866), `.../RecoletasPage.tsx` (834),
  `.../CulturasPage.tsx` (791)
- `src/modules/analises-clinicas/hooks/useAgendamentos.ts` (253 linhas — CRUD raso)

### Problema

`analises-clinicas` é de longe o módulo mais mexido do repositório (agendamento
retroativo, laudo, coletas, correção de identidade, envio ao Álvaro — todos
nos últimos 50 commits) e também o mais **raso na camada de hooks**: cada
`use*` é essencialmente um `fetch`/`map` sem regra de negócio, e cada regra de
negócio real vive dentro do componente de página, sem seam nenhum entre
"o que a tela desenha" e "o que a regra decide". Três sintomas concretos:

1. **A regra mais recém-adicionada não tem dono.** "Agendamento retroativo" —
   tema de dois dos últimos commits (`2c55080`, `c81bc4b`) — é calculada
   inteiramente dentro de `AgendamentosPage.tsx` (`hojeISO()`,
   `rotuloDiaPassado()`, linhas 130-146; `temRetroativo`/`slotRetroativo`,
   linhas 872-874). `useAgendamentos.ts`, que é o hook que efetivamente cria o
   agendamento, não sabe que "retroativo" existe.
2. **A mesma matemática de data-limite é reimplementada quatro vezes.**
   `useAgendamentos.ts:100-101`, `AgendamentosPage.tsx:151`,
   `PostosPage.tsx:22` e `IndicadoresPage.tsx:177-178` cada um monta janelas
   `T00:00:00`/`T23:59:59.999` com `new Date()` cru, sem util compartilhado.
3. **A tradução de status é reimplementada três vezes e já divergiu uma
   vez.** `CulturasPage.tsx:38`, `LaudosPage.tsx:33` e `RecoletasPage.tsx:38`
   cada um redefine `statusLabel = (s) => STATUS_X.find(...)`. Pior:
   `LaudosPage.tsx:705-707` calcula contadores de resumo comparando strings
   literais (`'aguarda_liberacao'`, `'laudo_completo_liberado'`) em vez de
   `STATUS_LAUDO` — o enum central em `types.ts:204-386` pode ser renomeado
   sem que este ponto quebre em tempo de compilação.

**Teste de deleção:** para a matemática de datas e os status labels, apagar
qualquer uma das cópias faz a complexidade **reaparecer** nas outras três —
prova de que não é indireção sobrando, é a ausência de um módulo que devesse
existir. Para a regra de retroativo, apagar `AgendamentosPage.tsx` não some
com a regra do sistema — ela reaparece na próxima tela que precisar mostrar
"este agendamento é no passado", porque hoje ela não tem um lugar fora da
JSX para morar.

### Solução

Não é sobre reduzir o tamanho dos componentes por estética — é sobre dar às
regras um seam próprio, testável sem montar a página inteira:

- Um módulo `analises-clinicas/domain/` (ou arquivos-utilitário no mesmo
  espírito de `faturamento/utils/formato.ts`, que já resolveu exatamente este
  problema para o faturamento) com `parseDataLocal`/`janelaDoDia` para a
  matemática de datas, e um `rotuloStatus(enum, valor)` genérico que
  substitui as três cópias — eliminando também a chance de `LaudosPage`
  divergir do enum.
- A regra de "agendamento retroativo" (é passado? precisa de confirmação
  extra? qual rótulo mostrar?) sai de `AgendamentosPage.tsx` e entra em
  `useAgendamentos.ts` como uma função pura exportada — o hook passa a
  **decidir**, não só buscar.

### Benefícios

- **Localidade**: um bug de fuso-horário na janela de data (a mesma classe de
  bug que o achado 2.6 da revisão de faturamento encontrou no backend) passa
  a ser corrigido uma vez, não caçado em quatro arquivos.
- **Testabilidade**: `parseDataLocal`, `janelaDoDia` e a regra de retroativo
  viram funções puras — testáveis sem Supabase, sem render de 1745 linhas de
  JSX. Hoje o módulo inteiro não tem um teste sequer justamente porque a
  única forma de exercitar essas regras é montar a página completa.
- **Leverage**: o próximo lugar que precisar saber "isso é retroativo?" (o
  módulo já tem correção de identidade, laudos, recoletas — todos tocam
  agendamento de algum jeito) importa a função em vez de reescrevê-la.

### Antes / Depois

```
ANTES                                     DEPOIS
AgendamentosPage.tsx (1745 linhas)        AgendamentosPage.tsx (mais fino)
 ├─ busca dados (hook raso)                 ├─ usa useAgendamentos()
 ├─ hojeISO / rotuloDiaPassado  ← regra    domain/datas.ts
 ├─ temRetroativo / slotRetroativo ← regra  └─ parseDataLocal, janelaDoDia
 └─ JSX                                    domain/status.ts
                                             └─ rotuloStatus(enum, valor)
PostosPage.tsx                            useAgendamentos.ts
 └─ sua própria janela de data ← duplicado  └─ calcularRetroatividade(...)
                                               (regra pura, testável)
IndicadoresPage.tsx
 └─ sua própria janela de data ← duplicado  PostosPage / IndicadoresPage
                                             └─ importam domain/datas.ts
CulturasPage / LaudosPage / RecoletasPage
 └─ statusLabel reimplementado 3x,
    LaudosPage já usa string literal solta
```

---

## Candidato C — Cada hook busca token e autocomplete de paciente do seu jeito

**Força: 🟡 Worth exploring**

> ✅ **Resolvido em `d7685af`** ("refactor(analises-clinicas): extrair domain
> de datas/status e unificar adapter das APIs"), junto do Candidato 3 da
> segunda rodada. `api.ts` agora concentra `getToken`, `chamarAcClinicasApi`
> (ex-`chamarApoioApi`, promovido a interface oficial do módulo) e um único
> `buscarPacientes`; `useAgendamentos`, `useCorrecaoIdentidade`,
> `useDocumentosAgendamento` e `apoioApi` passaram a usá-los, com suíte
> vitest cobrindo o contrato de erro.

**Arquivos:**
- `src/modules/analises-clinicas/hooks/useAgendamentos.ts:74-77, 121-139`
- `src/modules/analises-clinicas/hooks/useCorrecaoIdentidade.ts:51-54, 61-79`
- `src/modules/analises-clinicas/apoioApi.ts:17-32` (`chamarApoioApi<T>`)
- `src/modules/faturamento/hooks/useContasReceber.ts:27-30` (mesmo padrão, módulo diferente)

### Problema

`getToken()` (pegar `supabase.auth.getSession()` e devolver o
`access_token`) está copiado ao menos três vezes no repo — duas dentro de
`analises-clinicas`, uma em `faturamento`. `buscarPacientes` (typeahead de
paciente contra o LAB-HUB) está copiado quase literalmente entre
`useAgendamentos.ts` e `useCorrecaoIdentidade.ts`: mesma URL, mesmo
"engolir erro e devolver `[]`", mesma forma de parsear a mensagem de erro.

O interessante é que **o seam certo já existe**: `apoioApi.ts` generaliza
"pegar token → `POST` JSON → jogar erro se `!success`" numa função genérica
(`chamarApoioApi<T>`), mas só é usado pelos fluxos de envio ao Álvaro — os
dois hooks que duplicam a lógica não a chamam.

**Teste de deleção:** apagar qualquer uma das cópias de `getToken`/
`buscarPacientes` faz a complexidade reaparecer na cópia irmã — não é
indireção, é duplicação sem um dono único. Diferente do Candidato A, aqui
**um adapter já resolve o problema** (`chamarApoioApi`); falta só apontar os
chamadores para ele — "um adapter, seam hipotético" já virou "dois adapters
de fato" (apoio + potencialmente agendamentos/correção), então vale a pena
promovê-lo a interface oficial do módulo em vez de deixá-lo como utilitário
de um fluxo só.

### Solução

Mover `chamarApoioApi` (renomeado para algo como `chamarAcClinicasApi`, já
que deixaria de ser exclusivo do apoio) para um arquivo de nível de módulo, e
trocar as chamadas manuais de `fetch` + `getToken()` em `useAgendamentos` e
`useCorrecaoIdentidade` por ele. `buscarPacientes` vira uma função exportada
uma vez só, usada pelos dois hooks.

### Benefícios

- **Localidade**: uma mudança no contrato de erro do LAB-HUB (já documentada
  como "contratos sincronizados à mão" em `useCorrecaoIdentidade.ts:21-22`)
  passa a ser tratada num lugar só.
- Não é urgente como A ou B — é baixo risco, baixo esforço, e mais
  "arrumação" do que "achado" — por isso `Worth exploring`, não `Strong`.

---

## Recomendação principal

**Comece pelo Candidato A.** Não é só o mais barato dos dois fortes (um único
componente consumidor, ~370 linhas a remover) — é o único dos três que já
gerou um bug real e documentado (achado 1.1) em vez de só um risco teórico. O
destino da migração (`useContasReceber` + trigger `update_nota_valores`) já
está testado exaustivamente em `docs/plans/faturamento/revisao-contas-receber.md`,
então a fusão tem para onde ir sem precisar desenhar nada do zero — é
sobretudo apagar código, não escrever.

O Candidato B tem leverage maior no longo prazo (é o módulo que mais recebe
commits e mais cresce), mas é um trabalho de desenho maior: decidir o formato
de `domain/` para `analises-clinicas` vale uma rodada de `/codebase-design`
("design it twice") antes de mexer, dado que oito componentes de 800+ linhas
dependeriam da forma escolhida.

O Candidato C pode ser feito como sub-tarefa de B (mesma pasta de destino,
mesmo módulo) ou isoladamente, quando alguém já estiver mexendo em um dos
dois hooks por outro motivo.
