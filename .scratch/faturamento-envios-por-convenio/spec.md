# Faturamento: visão agregada de envios por convênio em Contas a Receber

Status: 3 issues, todas `ready-for-agent`.

Spec resultante de sessão de grilling em 2026-09-04, a partir de um pedido
literal do cliente (repassado pelo usuário via `/grill-me`).

## Contexto

Pedido original do usuário: "na parte de 'novo título a receber' tem uma
lista de lotes, o meu cliente disse que quer poder ver e analisar essa lista
em outro local". A investigação de código (3 sub-agentes) e o grilling com o
cliente (mensagem literal colada na sessão) revelaram que o pedido real é
mais específico do que "mover a lista pra outro lugar":

> "quero ver todos os convênios, do mês do trimestre ou do período que eu
> precisar ver sem precisar selecionar o convênio. Hoje o título gera a
> informação somente por convênio selecionado; quero poder visualizar todos
> os convênios do trimestre/mês etc, sem a necessidade inicial de criar um
> título."

Ou seja: hoje a única forma de o cliente obter uma visão organizada de lotes
é passando pelo fluxo de criar título — que é sempre por um convênio de cada
vez (`NovoTituloModal.tsx`, sempre `somenteSemTitulo=1`, sem filtro
estruturado por convênio). Existe uma tela irmã, `FaturasDashboard.tsx`
(rota separada `/faturamento/faturas`, fora de "Contas a Receber"), que já
lista lotes de todos os convênios com filtro de período sem exigir título —
o cliente **já conhece essa tela e ela não resolve**, porque é uma lista
plana por lote, sem nenhuma agregação por convênio (confirmado por
investigação de código: `FaturasDashboard.tsx` não agrupa/soma por
`fontePagadora` em lugar nenhum).

## Decisões da sessão de grilling

- **Local**: nova aba dentro de "Contas a Receber" (`ContasReceberPage.tsx`,
  hoje `'dashboard' | 'titulos' | 'pendencias'`), não um export nem
  ferramenta externa.
- **Audiência**: uso interno, mesmo usuário que já acessa o FlowLab — sem
  necessidade de compartilhamento com terceiros.
- **Formato**: tabela **agregada por convênio** (fonte pagadora), não lista
  de lotes individuais. Colunas: convênio, qtd. de lotes, qtd. de
  requisições/guias, valor total.
- **Status padrão**: só lotes "enviados" — STLOT 2 (Conciliação) e 3
  (Faturado) — com filtro disponível para expandir a outros status
  (reaproveitar `STLOT_LABELS`, `src/modules/faturamento/types/index.ts`).
- **Período**: preset "Mês atual" (padrão ao abrir), "Trimestre atual"
  (calendário — já existe como utilitário `periodoEsteTrimestre()` em
  `src/modules/faturamento/utils/formato.ts`, usado em `TitulosList.tsx`,
  só não está exposto na `FaturasDashboard`), e personalizado.
- **Convênios sem movimentação no período**: ocultos (não aparecem com
  zero).
- **Ordenação padrão**: valor total decrescente.
- **Drill-down**: clicar num convênio navega para a `FaturasDashboard`
  (`/faturamento/faturas`) já filtrada por aquele convênio + período — a
  rota antiga continua existindo como está, sem mudança de comportamento
  para quem acessa direto.
- **Precisão do drill-down**: filtro **estruturado por `IdFontePagadora`**
  (não busca textual aproximada) — decisão explícita do usuário priorizando
  precisão numa ferramenta financeira, mesmo custando um pouco mais de
  esforço (a `FaturasDashboard` hoje só filtra fonte pagadora via busca
  livre `LIKE`, e não tem nenhuma sincronia de URL/query params — confirmado
  por investigação de código, `FaturasDashboard.tsx:90`, sem
  `useSearchParams`/`useLocation` em lugar nenhum do arquivo).
- **Permissão**: nenhuma nova — reaproveita `canViewBilling`, que já gate
  toda a página `ContasReceberPage.tsx` a nível de rota (as abas internas
  não têm permissão própria hoje).
- **Fora de escopo**: export (CSV/PDF), gráficos, compartilhamento externo.

## Issues

- `issues/01-aba-envios-tabela-agregada-convenio.md` — feature,
  ready-for-agent
- `issues/02-faturas-filtro-estruturado-convenio-url.md` — feature,
  ready-for-agent
- `issues/03-drilldown-convenio-navega-faturas-filtrada.md` — feature,
  ready-for-agent (bloqueada por 01 e 02)
