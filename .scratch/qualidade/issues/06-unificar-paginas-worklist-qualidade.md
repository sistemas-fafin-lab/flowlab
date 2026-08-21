Status: done
Type: task

# Unificar o esqueleto das 4 páginas de worklist de Qualidade (Ocorrências, Cortesias, IHQ, Câncer)

## Onde

`OcorrenciasPage.tsx` (281 linhas), `CortesiasPage.tsx` (449), `IhqPage.tsx` (360) e
`CancerPage.tsx` (332) repetem o mesmo esqueleto ponta a ponta — confirmado lendo as quatro
por completo, não só por semelhança superficial:

1. **Header idêntico** — `<h1>` + descrição, botão "Sincronizar" com `RefreshCw` girando,
   gated por `canManage` (`useCanManageQualidade`), `disabled={!periodoCompleto ||
   sync.isPending}`. Mesmas classes Tailwind nos 4 arquivos (ex.:
   `OcorrenciasPage.tsx:206-218`, `CortesiasPage.tsx:331-341`, `IhqPage.tsx:285-297`,
   `CancerPage.tsx:230-241`).
2. **Mesmo par de hooks de dado**: `useQuery({ queryKey: [dominio, filtro], queryFn,
   enabled: periodoCompleto })` + `useMutation` de sync que invalida a mesma queryKey do
   `useQuery` — forma idêntica nas 4 páginas, só troca `dominio`/`queryFn`/`syncFn`.
3. **`SeletorPeriodoPorMes` + guarda de "selecione o período"** — bloco idêntico nas 4
   (`inicio`/`fim`/`anoPadrao={anoAtual()}`/`onMudar={definirPeriodo}` via
   `usePeriodoCompartilhado`).
4. **Loading/erro/vazio idênticos**: 3 `<Skeleton>` em `space-y-2`, `<ErrorState>` com a
   mesma checagem `error instanceof ErroApi && error.status === 401` → "sessão não
   autenticada" (`OcorrenciasPage.tsx:244-254`, `CortesiasPage.tsx:389-399`,
   `IhqPage.tsx:323-333`, `CancerPage.tsx:264-274` — texto do título muda, o resto é
   copy-paste).
5. **`TabelaExpansivel` + abrir drawer por `id` no clique da linha**, com `idSelecionado`
   em `useState<string | null>` e o drawer renderizado condicionalmente no fim do JSX — nos
   4 arquivos.
6. **Badge "revisão pendente" (pílula roxa)** — JSX idêntico, caractere por caractere, em
   `OcorrenciasPage.tsx:186-190`, `CortesiasPage.tsx:290-294` e `IhqPage.tsx:264-268` (Câncer
   não tem esse campo).
7. Cada página redefine seu próprio `Record<StatusEnum, string>` de classes Tailwind para
   badge de status de curadoria (`BADGE_STATUS` em Ocorrências/Cortesias/IHQ) com as mesmas
   4 combinações de cor (cinza=pendente, azul=em_análise, verde=concluída,
   cinza-claro=descartada) — três tipos (`StatusCuradoriaCortesia`, `StatusCuradoriaIhq`, e o
   campo solto em `OcorrenciaDTO`) modelando o mesmo conceito de workflow de curadoria.

`TabelaExpansivel` (`components/ui/TabelaExpansivel.tsx`) já é o primitivo genérico correto
— tema por `cor`, engine de ordenação/filtro/busca reaproveitado via `ColunaTabela<T>[]`. A
duplicação está uma camada acima dele: no *shell* de cada página que a envolve.

Os 4 **drawers** (`ocorrencias/CuradoriaDrawer.tsx`, `cortesias/CuradoriaDrawer.tsx`,
`ihq/VinculoDrawer.tsx`, `cancer/CasoDrawer.tsx`) têm o mesmo problema num nível abaixo:
`createPortal` → overlay `fixed inset-0 z-[60]` com `bg-black/50 backdrop-blur-sm` →
painel `animate-slide-in-right` da direita com header (título + botão X) → corpo
`overflow-y-auto` → footer com Cancelar/Salvar. Mesma marcação nos 4 arquivos, com pequenas
variações de largura (`max-w-3xl` vs `sm:max-w-xl lg:max-w-4xl`) e de grid interno
(2 colunas vs 1).

## O que NÃO é duplicação (não deve ser forçado para dentro de um shell genérico)

- IHQ agrupa linhas por requisição (`agruparPorRequisicao`, `IhqPage.tsx:68-81`) — as
  outras 3 mostram 1 linha = 1 registro.
- Cortesias tem sino de notificações (`NotificacoesModal`), link "Cotas" e um card-filtro de
  pendentes de autorização — nenhuma das outras 3 tem equivalente.
- Câncer tem funil com 5 contadores, alerta de retificação pendente, células de
  classificação editáveis inline (`CelulaClassificacao`/`BuscaCido`) e o card de exportação
  RHC — é a página com mais lógica própria das 4.
- IHQ e Ocorrências não têm card de métricas acima da tabela; Cortesias e Câncer têm.

## O que fazer

Extrair dois shells genéricos, mantendo cada página fina, com só o que é dela:

1. **`<PaginaWorklist>`** (ou hook `useWorklistQuery` + componente de layout) cobrindo os
   itens 1–5 acima: título/descrição, botão sincronizar, seletor de período, guarda de
   período incompleto, loading/erro/vazio, `TabelaExpansivel`, abertura de drawer por id.
   Parametrizado por: `titulo`, `descricao`, `dominio` (chave de query), `queryFn`,
   `syncFn`, `colunas`, `corTabela`, `drawer` (componente), e slots opcionais para conteúdo
   extra no header (sino, link, card de filtro) e acima da tabela (métricas, alertas) — sem
   esses slots, Cortesias e Câncer não cabem no shell.
2. **`<DrawerLateral>`** cobrindo o esqueleto de portal/overlay/painel/header/footer dos 4
   drawers, recebendo `titulo`, `largura`, `aoFechar`, `carregando`/`erro`, e o corpo como
   `children`.
3. Extrair o badge "revisão pendente" para um componente único (`<BadgeRevisaoPendente
   revisaoPendente={...} />`) reaproveitado nas 3 páginas que o usam.

Decidir antes de implementar:

- **Unificar também o vocabulário de status de curadoria** (`StatusCuradoriaCortesia` /
  `StatusCuradoriaIhq` / status solto de Ocorrência) num único tipo compartilhado com um
  helper `corBadgeStatusCuradoria(status)`? É uma mudança de modelagem de domínio, não só de
  UI — maior escopo que os shells de layout acima. Recomendo tratar como issue separada se
  for adiante, para não travar a extração de shell nesta.
- Onde os slots extras (sino de notificação, card de filtro, métricas) entram no contrato do
  `<PaginaWorklist>` — como children posicionados (`extraHeader`, `acimaDaTabela`) ou como
  render props. Ver se vale a pena para só 2 das 4 páginas usarem, ou se é simples o
  suficiente para deixar fora do componente genérico e cada página continuar compondo o
  próprio JSX ao redor do shell.

## Critérios de aceite

- `OcorrenciasPage.tsx`, `IhqPage.tsx` encolhem para essencialmente: colunas + drawer +
  chamada ao `<PaginaWorklist>` — sem repetir header/período/loading/erro/vazio.
- `CortesiasPage.tsx` e `CancerPage.tsx` continuam com sino/cotas/card de pendentes e
  funil/alerta/exportação respectivamente, funcionando sem regressão visual ou de
  comportamento.
- Os 4 drawers usam `<DrawerLateral>` sem mudar o comportamento de abrir/fechar/scroll.
- Nenhuma mudança de comportamento observável (mesmos filtros, mesmas cores de tabela por
  módulo — `blue`/`amber`/`purple`/`rose` — mesmas mensagens de erro/vazio).
- Testes existentes (`ocorrenciasIndicadores.test.ts`, `cortesiasRegras.test.ts`,
  `ihqRegras.test.ts`, `cancerRegras.test.ts`) continuam verdes — nenhum é afetado
  diretamente por isso, mas servem de smoke check de que a lógica de domínio não foi tocada.

## Comments

Implementado: `components/ui/PaginaWorklist.tsx` (shell genérico — header, período,
loading/erro/vazio, `TabelaExpansivel`, slots `extraHeader`/`acimaDaTabela`/`abaixoDaTabela`/`drawer`)
e `components/ui/DrawerLateral.tsx` (portal/overlay/painel/header/footer). Badge de
"revisão pendente" extraído para `components/ui/BadgeRevisaoPendente.tsx`. As 4 páginas e os
4 drawers foram reescritos em cima desses shells — `OcorrenciasPage.tsx`/`IhqPage.tsx` ficaram
só com colunas + drawer + chamada ao shell; `CortesiasPage.tsx`/`CancerPage.tsx` mantiveram
sino/cotas/card de pendentes e funil/alerta/exportação via os slots. Vocabulário de status de
curadoria (`StatusCuradoriaCortesia`/`StatusCuradoriaIhq`/status de Ocorrência) **não** foi
unificado — deixado como issue separada, conforme a nota no corpo do ticket.

`tsc --noEmit`, `eslint` e a suíte de testes (161 testes, incluindo os 4 smoke checks de
domínio) passam sem novos erros. Todo módulo alterado transforma limpo sob o Vite dev server.
Teste manual no navegador não foi possível nesta sessão (rotas exigem login Supabase sem
credenciais disponíveis) — recomendo um smoke visual das 4 páginas + 4 drawers antes de dar
como definitivamente fechado visualmente.
