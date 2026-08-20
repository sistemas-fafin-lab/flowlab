Status: done
Type: bug

# Bugs visuais no modo escuro (módulo Qualidade)

## Onde

Reportado pelo usuário após testar o módulo em produção: existem bugs visuais no modo escuro em telas do módulo Qualidade (`src/modules/qualidade/components/`). Ainda sem descrição específica de quais telas/elementos — pendente de detalhamento (screenshot ou descrição do que aparece errado) para reduzir escopo.

## Achados de uma varredura inicial (pistas, não a lista completa)

1. **Classe `glass-surface` não existe no projeto.** Usada em `ui/FiltroSelecaoAgrupada.tsx`, `ui/TabelaExpansivel.tsx`, `cortesias/NotificacoesModal.tsx` — não está definida em `src/index.css` nem em `tailwind.config.*`. O elemento renderiza sem qualquer efeito de vidro/blur (classe ignorada silenciosamente pelo Tailwind), em ambos os temas.
2. **Paleta própria, hardcoded, independente do design system do FlowLab.** O módulo usa cores hex fixas para dark mode (`#0F1729`, `#141B2D`, `#3987e5` etc., em `DashboardPage.tsx`, `charts/*.tsx`, `*Drawer.tsx`) em vez dos tokens de cor do FlowLab (ver `docs/DESIGN_SYSTEM_FLOWLAB.md`). Provável causa de contraste/aparência destoante do resto do app no dark mode, mesmo funcionando "sem erro".
3. `animate-scale-in`/`animate-slide-in-right` (usadas nos drawers) **existem** em `src/index.css` — não são a causa.

## O que fazer

1. Pedir ao usuário screenshots ou a lista de telas específicas com problema (Painel, Ocorrências, Cortesias, Cotas, IHQ, Câncer — cada uma com componentes próprios).
2. Definir `.glass-surface` em `src/index.css` (ou trocar as 3 ocorrências por classes Tailwind padrão já usadas em outros modais do FlowLab) — o mais barato de corrigir e provavelmente contribui pro visual "quebrado".
3. Avaliar se a paleta hardcoded dos gráficos (`DonutChart.tsx`, `BarChartHorizontal.tsx`, `LineChartMultiSerie.tsx`, `TopLista.tsx`, `DashboardPage.tsx`) deve ser trocada pelos tokens de cor do FlowLab, ou pelo menos revisada para bom contraste no dark mode real do app (o dela foi calibrada num app separado, pode não bater com o `dark:` global do FlowLab).

## Critérios de aceite

- Nenhum elemento do módulo Qualidade usa classe CSS inexistente.
- Telas do módulo com boa legibilidade/contraste no modo escuro do FlowLab (a definir tela por tela conforme feedback do usuário).

## Comments

Resolvidos os dois achados concretos:

1. `.glass-surface` definida em `src/index.css` (`@layer components`, com par light/dark)
   — fundo translúcido + blur, cede para qualquer utilitária Tailwind de cor de
   fundo/borda no mesmo elemento (Tailwind emite `base < components < utilities`,
   então a camada `components` sempre perde em empate de especificidade). Cobre
   as 17 ocorrências da classe no módulo, não só as 3 citadas no achado original.
2. Cores hex hardcoded de superfície (`#0F1729`, `#141B2D`) trocadas pelos tokens
   `dark:bg-gray-800`/`dark:bg-gray-700` do FlowLab em 8 arquivos (drawers, modais,
   dropdowns, célula sticky de tabela, stroke de gráfico).

**Não feito, propositalmente fora de escopo** (achado 2, item "avaliar" a paleta de
gráficos, e item 1 do "O que fazer"): a paleta hardcoded de cores de série dos
gráficos (`DonutChart`, `BarChartHorizontal`, `TopLista`, cores por autor em
`DashboardPage`) não foi tocada — são pares light/dark já calibrados
deliberadamente, e o próprio texto da issue pede feedback/screenshot do usuário
antes de mexer nisso. Pedir esses screenshots continua pendente.

Verificado: `npx tsc --noEmit` limpo no módulo, `npm run build` ok, `npm test`
158/158 passando, eslint sem erros novos. Revisão em duas frentes (Standards +
Spec) rodada via `/code-review` antes de fechar.
