# Feedback do stakeholder — Dashboard, View de Faturamento e Design System

Documento de planejamento a partir de um feedback recebido em 10/08/2026 sobre o
módulo de faturamento (branch `feature/faturamento-lotes-aplis`). O feedback
pedia três frentes; um levantamento no código mostrou que a primeira já está
praticamente entregue, e as decisões abaixo fecham o escopo das outras duas.

**Status geral**

| # | Frente | Status |
|---|---|---|
| 1 | Dashboard (KPIs, filtros, previsão de pagamento) | ✅ já implementado — sem pendência funcional |
| 2 | View de Faturamento (filtros salvos) | ✅ implementado em 10/08/2026 (`ef40dda`, `8d27c87`, `58b9f2e`, `eb83ade`) |
| 3 | Polimento de design system | ✅ implementado em 11/08/2026 |

---

## 1. Dashboard — já implementado

`ContasReceberDashboard.tsx` (aba dentro de `ContasReceberPage`, rota
`/faturamento/recebimentos`) já entrega tudo que o feedback pedia:

- **KPIs**: valor faturado, valor recebido, valor glosado, valor acatado
  (`ContasReceberDashboard.tsx:394-442`).
  - "Valor acatado" = soma de `glosas.status = 'definitiva'` (glosa mantida
    pela operadora, sem reversão). Confirmado com o time como a definição
    correta.
- **Filtros**: período, operadora, lote e nota fiscal, via
  `FiltrosReceber.tsx` (modal com multi-seleção).
  - O filtro de período usa `lotes.data_envio` como referência (mesma data
    usada nas regras de previsão de pagamento), conforme decidido.
- **Previsão de pagamento — prazo médio simples e ponderado**
  (`ContasReceberDashboard.tsx:444-481`, cálculo em
  `supabase/migrations/20260807150000_previsao_pagamento.sql`):
  - Unidade de análise: **nota fiscal** (`notas`/"título"), não o lote — um
    lote pode conter várias notas (`nota_lote` é N:N), cada uma com seu
    próprio prazo.
  - Prazo real = `lotes.data_envio` (máximo dos lotes vinculados à nota) até
    `MIN(recebimentos.data_receb)` com status `recebido`/`parcial` —
    "primeiro recebimento registrado para aquele título".
  - Títulos sem nenhum recebimento ainda **não entram** na média (a agregação
    usa `AVG`/`SUM` sobre `dias_reais`, que é `NULL` até haver recebimento —
    comportamento já correto, sem necessidade de filtro extra).
  - Média ponderada: peso = **valor recebido** na primeira data de
    recebimento (`SUM(dias_reais*peso)/SUM(peso)`), exatamente o critério
    escolhido.
  - Bônus existente (não pedido, mas mantido): "previsão contratual" por
    operadora, via `fat_regra_prazo`/`fat_prever_pagamento`.

Nenhuma ação de código necessária nesta frente. Se o time quiser, cabe uma
verificação de QA manual (navegar até `/faturamento/recebimentos`, aba
Dashboard, conferir os números contra uma amostra manual) — não incluída aqui
por não ter sido pedida.

---

## 2. View de Faturamento — ✅ implementado

Feature nova: permitir ao usuário montar um conjunto de filtros, aplicá-lo, e
opcionalmente salvá-lo como uma "view" nomeada para reuso.

**Implementado em 4 commits** (nesta ordem, cada um typecheck/lint limpos):

1. `ef40dda` — migration `supabase/migrations/20260810160000_fat_views_salvas.sql`:
   tabela `fat_views_salvas` (`usuario_id`, `tela`, `nome`, `filtros jsonb`,
   `UNIQUE(usuario_id, tela, nome)`) + RLS por dono, sem RPC.
2. `8d27c87` — tipos `ViewSalva`/`ViewSalvaTela` em `billing/types` e o hook
   `src/modules/faturamento/hooks/useViewsSalvas.ts` (listar/salvar — upsert
   por nome/renomear/excluir), direto ao Supabase como `useContasReceber`.
3. `58b9f2e` — menu "Views" integrado em `FiltrosReceber.tsx` (tela `dashboard`).
4. `eb83ade` — menu extraído para `src/modules/faturamento/components/ViewsSalvasMenu.tsx`
   (genérico em `TFiltros`/`tela`) e reaproveitado em `TitulosList.tsx` (tela
   `titulos`, sem `pagina`/`tamanho` no que é salvo) e `GlosasRecursos.tsx`
   (tela `glosas`, único campo de status).

Não testado num navegador de verdade (sem ferramenta de browser disponível
nem credenciais de login no ambiente da implementação) — validado por
typecheck, lint e leitura do código. Vale um teste manual antes de considerar
fechado de vez.

**Não existe nenhum precedente no projeto** — nem tabela jsonb para
preferências de UI, nem componente de "salvar filtro" em nenhum módulo. O
único estado salvo hoje é o layout de widgets do dashboard, em
`localStorage` (`ContasReceberDashboard.tsx:61-63`, chave
`flowLab_contas_receber_layout_v2`) — não serve de base, pois é
posição/tamanho de card, não filtros, e não usa banco.

**Decisões de escopo**

- Cobre **todo o módulo de faturamento**: Dashboard (`ContasReceberDashboard`),
  lista de Títulos (`TitulosList`), Glosas/Recursos (`GlosasRecursos`) e
  qualquer outra tela que hoje tenha filtro via `FiltrosReceber` ou
  equivalente.
- Views são **privadas por usuário** (RLS por `usuario_id`), sem
  compartilhamento entre usuários nesta entrega.
- Fluxo (conforme feedback original):
  1. Usuário clica em "Nova view" na tela onde está.
  2. Seleciona os filtros desejados (reaproveitando os componentes de filtro
     já existentes na tela).
  3. Sistema aplica os filtros e exibe o resultado filtrado imediatamente
     (preview), sem exigir salvar antes de ver o efeito.
  4. Usuário decide se salva a view com um nome, ou apenas descarta depois de
     usar.
  5. Views salvas ficam disponíveis para reaplicação rápida (ex.: dropdown
     "Minhas views" na mesma tela).

**Esboço de modelo de dados** (a refinar na implementação)

- Nova tabela, ex. `fat_views_salvas`:
  - `id`, `usuario_id` (FK, RLS), `tela` (identificador da tela/contexto —
    dashboard, titulos, glosas, ...), `nome`, `filtros jsonb`, `criado_em`.
- RPC ou acesso direto via Supabase client para criar/listar/excluir views do
  próprio usuário, seguindo o padrão de RPCs já usado no módulo
  (`fat_criar_titulo`, `fat_registrar_baixa`).

---

## 3. Polimento de design system — ✅ implementado

**Implementado em 9 commits** (`1012e90` DatePicker novo; `6ba6ab4`
BaixaModal; `b7b6ed3` NovoTituloModal; `cdc8f48` GlosasRecursos;
`2edb4cf` TitulosList; `b92ebe6` FiltrosReceber; `730049b`
FaturasDashboard legado; `5007337` ajuste cirúrgico no
ContasReceberDashboard), cada um com `tsc --noEmit` e `eslint`
limpos nos arquivos tocados.

Todos os pontos mapeados na tabela abaixo foram substituídos por
`Select`/`DatePicker`. Não testado num navegador de verdade (mesma
limitação do item 2 — sem ferramenta de browser nem credenciais no
ambiente de implementação); vale um teste manual clicando em cada
tela antes de considerar fechado de vez.

### Escopo original

Pedido original: usar o módulo de TI como referência, evitar controles
nativos do browser (`<select>`, `<input type="date">`, listas simples),
priorizar visual "premium".

**Contexto encontrado**

- O módulo de TI (`src/components/IT/`) **não é uma referência limpa**: só a
  camada de dashboard (`ITProjectDashboard.tsx`, `ITHubDashboard.tsx`) tem o
  visual "vidro" (`bg-white/60 backdrop-blur-xl rounded-3xl`) — os
  formulários de TI também usam `<select>`/`<input type="date">` nativos
  (`ITRequestManagement.tsx:961`, `KanbanPromoteModal.tsx:365,430,449,467`,
  `ITProjectManager.tsx:716,725`, `ITHubDashboard.tsx:402,410`,
  `ITTaskDrawer.tsx:1378`). A referência real a seguir é o estilo visual dos
  cards de dashboard, não os formulários de TI.
- `ContasReceberDashboard.tsx` **já segue** essa linguagem visual (comentário
  próprio no arquivo confirma que foi copiada do padrão do
  `src/components/Dashboard.tsx`) — é o exemplo a manter/replicar.
- Existe um componente de design system genérico pronto,
  `src/components/Select.tsx` ("Dropdown do design system... substitui o
  `<select>` nativo", com navegação por teclado e posicionamento
  inteligente), mas **não é usado em nenhum lugar do projeto hoje**.
- **Não existe nenhum DatePicker customizado** no projeto — todo
  `input type="date"` é nativo do browser.

**Decisões de escopo**

- Reaproveitar `Select.tsx` (evita duplicar design system) em todos os pontos
  do faturamento que hoje usam `<select>` nativo.
- Criar um `DatePicker` customizado novo e reutilizável (não existe base
  pronta no projeto) para substituir os `input type="date"` nativos.
- `FaturasDashboard.tsx` (dashboard legado, ainda roteado em
  `/faturamento/faturas`, separado do novo `/faturamento/recebimentos`)
  **entra no escopo** do polimento — continua ativo e acessível, então não
  deve ficar destoante do resto do módulo.
- `ContasReceberDashboard.tsx` entra no escopo com ajustes **cirúrgicos**
  apenas (já está no padrão premium; revisão fina, não reescrita).

**Pontos mapeados a substituir**

| Arquivo | Controles nativos a substituir |
|---|---|
| `BaixaModal.tsx` | `type="date"` (:230); `<select>` (:247, :360, :374) |
| `NovoTituloModal.tsx` | `type="date"` (:216, :225, :389, :407) |
| `GlosasRecursos.tsx` | `<select>` de filtro de status (:248); `type="date"` (:407) |
| `FaturasDashboard.tsx` (legado) | `type="date"` (:315, :322); `<select>` (:330, :377) |
| `TitulosList.tsx` | `type="date"` (:162, :171); `<select>` (:179, :192) |
| `FiltrosReceber.tsx` | Campos de data ainda nativos (:516, :525) — já tem `SelecaoMultipla`/`CampoTermos` customizados para lote/nota, só faltam as datas |
| `ContasReceberDashboard.tsx` | Sem controles nativos pendentes — revisão cirúrgica de acabamento (espaçamento, estados de hover/loading, consistência com o restante) |

---

## Decisões registradas (rastreabilidade)

| Pergunta | Decisão |
|---|---|
| Peso da média ponderada | Valor recebido na primeira data |
| Unidade de análise do prazo | Por nota fiscal |
| Títulos sem recebimento ainda | Excluídos da média |
| Filtro de período do dashboard | Data de envio do lote |
| Definição de "valor acatado" | Glosas com status `definitiva` |
| Escopo das views salvas | Todo o módulo de faturamento |
| Visibilidade das views | Privada por usuário |
| Select/DatePicker | Reaproveitar `Select.tsx` existente + criar `DatePicker` novo |
| Dashboard legado (`FaturasDashboard.tsx`) | Entra no escopo do polimento |
