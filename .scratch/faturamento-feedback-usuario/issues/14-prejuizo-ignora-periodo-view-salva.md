Status: wontfix
Type: task

# Faturas: status "Prejuízo" volta a sumir ao aplicar uma View salva

## Onde

`src/modules/faturamento/utils/periodo.ts` e `components/FaturasDashboard.tsx` (lógica da issue 02 — `statusIgnoraPeriodo`, comentário em `:239` "não usa `range` aqui... a menos que o usuário já tenha escolhido um período personalizado"). Views salvas: `hooks/useViewsSalvas.ts`, `utils/viewsSalvas.ts`, `components/ViewsSalvasMenu.tsx`.

## Problema

A issue 02 fez o filtro por status "Prejuízo" (STLOT 8) ignorar o preset de período padrão — **exceto** se o usuário já tiver escolhido um período customizado, caso em que o período customizado prevalece. Uma View salva que tenha sido gravada com um período customizado (ex.: "mês atual" fixado num range específico, ou qualquer range que não cubra um lote Prejuízo antigo) restaura esse período customizado ao ser aplicada — e a lógica atual trata isso como "usuário já escolheu período customizado", desligando a exceção de Prejuízo. O lote Prejuízo volta a sumir da lista, reproduzindo o sintoma original mesmo com a issue 02 implementada.

## O que fazer

1. Distinguir "período customizado restaurado de uma View salva" de "período alterado manualmente pelo usuário na sessão atual".
2. A exceção de Prejuízo (ignorar período) continua valendo quando o período em vigor veio de uma View salva — só é desligada quando o usuário mexe no período manualmente depois de aplicar a view (ou fora do contexto de view nenhuma).

## Critérios de aceite

- Aplicar uma View salva com período customizado + filtro de status incluindo "Prejuízo" continua mostrando lotes Prejuízo fora desse período.
- Se o usuário, depois de aplicar a view, ajustar o período manualmente, o comportamento normal (respeitar o período escolhido) volta a valer.

## Referência

Novo relatório de feedback do setor de faturamento (24/08), item 3.2. Achado de causa raiz nesta sessão de grilling (24/08): interação entre a exceção de Prejuízo (issue 02) e a restauração de período pelas Views salvas.

## Comments

Investigação de implementação (24/08): a premissa da issue não se sustenta no código atual.

- `janelaEfetiva`/`statusIgnoraPeriodo` (a exceção de Prejuízo) só existe em `FaturasDashboard.tsx` (aba Faturas/lotes).
- Views Salvas (`useViewsSalvas`, `ViewsSalvasMenu`) só está integrado em `FiltrosReceber.tsx` (dashboard/painel), `TitulosList.tsx` (títulos) e `GlosasRecursos.tsx` (glosas) — zero referência em `FaturasDashboard.tsx`.
- `fat_views_salvas.tela` tem `CHECK (tela IN ('dashboard', 'titulos', 'glosas'))` — não existe `'faturas'` como tela válida; não dá para salvar uma view a partir da aba Faturas hoje.

Ou seja: hoje não é possível reproduzir o cenário descrito, porque a aba Faturas não tem Views Salvas. Nenhuma das telas que têm Views Salvas (dashboard/títulos/glosas) usa a lógica "período ignorado por status" — então também não há a interação lá.

Fechando como `wontfix` por não ser reproduzível no código atual. Se o setor de faturamento realmente reproduziu isso na prática, provavelmente foi confusão com outra tela durante o grilling — reabrir com uma reprodução passo a passo (qual aba, qual view, qual período) se acontecer de novo.
