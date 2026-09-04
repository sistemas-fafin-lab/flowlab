# 03 — Drill-down: clicar num convênio leva à lista detalhada já filtrada

**What to build:** na nova aba "Envios" (ticket 01), clicar numa linha de
convênio navega o usuário para a tela de Faturas (`/faturamento/faturas`),
já filtrada exatamente por aquele convênio e pelo mesmo período que estava
selecionado na aba agregada — fechando o fluxo ponta a ponta pedido pelo
cliente: visão geral de todos os convênios → detalhe de um convênio
específico, sem precisar refazer nenhum filtro manualmente.

A rota `/faturamento/faturas` continua acessível e funcionando como sempre
para quem chega nela direto (sem parâmetros) — o drill-down só passa a
usar a capacidade de filtro/estado inicial que o ticket 02 adiciona.

**Blocked by:** 01, 02

**Status:** done

- [x] Clicar numa linha de convênio na aba "Envios" navega para
      `/faturamento/faturas`
- [x] A tela de destino já abre filtrada exatamente pelo convênio clicado
      (via `IdFontePagadora`, não busca aproximada) e pelo mesmo período que
      estava selecionado na aba "Envios"
- [x] O usuário não precisa reaplicar nenhum filtro manualmente após o
      clique
- [x] Acessar `/faturamento/faturas` direto pelo menu, sem vir do
      drill-down, continua funcionando exatamente como antes

## Comments

Implementado em `EnviosPorConvenio.tsx`: linha de convênio (com
`fontePagadoraId` não nulo) fica clicável/focável (`role="button"`,
`tabIndex`, `Enter`/`espaço`) e navega via `useNavigate` para a URL montada
por `urlFaturasFiltradasPorConvenio` (novo utilitário puro em
`utils/filtrosUrl.ts`, testado em `filtrosUrl.test.ts`), que monta
`/faturamento/faturas?idFontePagadora=...&periodoIni=...&periodoFim=...` —
os mesmos nomes de parâmetro já lidos por `FaturasDashboard.tsx` desde a
issue 02 (`idFontePagadoraInicialDaUrl`/`periodoInicialDaUrl`). Convênios
sem `fontePagadoraId` ("Não identificado") não têm drill-down, por não
haver id exato para filtrar.
