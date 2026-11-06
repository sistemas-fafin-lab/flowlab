# 01: Cards de pendência no Dashboard

**What to build:** o card "Pendências de faturamento" do Dashboard do Contas a Receber passa a ter 3 cards: **Requisições não faturadas** (sem lote, até M-1), **Particulares sem NF** (até D-1) e **Lotes sem nota fiscal** (a regra de hoje: sem NF/RPS, status de pendência, até M-1). Mesmo seletor de mês para os três. Clicar leva à sub-aba correspondente de Pendências. As regras das listas não mudam. Ver `../spec.md`.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] O valor de "Requisições não faturadas" bate com o total da sub-aba "Sem lote" no mesmo mês.
- [ ] O valor de "Lotes sem nota fiscal" bate com o card antigo (R$ 93.939,56 / 41 lotes em 06/2026).
- [ ] Cada card mostra valor e quantidade; o clique abre a sub-aba certa.
- [ ] Falha do apLIS mostra aviso e "Tentar novamente".
- [ ] Testes de rota (padrão de `faturamento-pendencias-particulares.test.ts`); `npm test` e typecheck passam.
