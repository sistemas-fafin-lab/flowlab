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

**Status:** ready-for-agent

- [ ] Clicar numa linha de convênio na aba "Envios" navega para
      `/faturamento/faturas`
- [ ] A tela de destino já abre filtrada exatamente pelo convênio clicado
      (via `IdFontePagadora`, não busca aproximada) e pelo mesmo período que
      estava selecionado na aba "Envios"
- [ ] O usuário não precisa reaplicar nenhum filtro manualmente após o
      clique
- [ ] Acessar `/faturamento/faturas` direto pelo menu, sem vir do
      drill-down, continua funcionando exatamente como antes
