# 02: Seção "NFs canceladas" no painel lateral do título

**What to build:** o painel lateral do título mostra uma seção "NFs canceladas" com cada NF anterior do título. Cada NF mostra número, data do cancelamento, motivo e quem registrou, com a mais recente primeiro. A seção só aparece se o título já teve alguma NF cancelada. Regras em `.scratch/faturamento-nf-cancelada/spec.md`.

**Blocked by:** 01 (Registrar a NF anterior como cancelada ao trocar o número).

**Status:** done (28/Out/2026; sem migration própria, lê a tabela da 01, já em produção); falta a conferência manual no app

- [x] O detalhe do título, que alimenta o painel lateral, passa a trazer a lista de NFs canceladas dele. (Leitura própria `buscarNfsCanceladas`, no padrão de `buscarAlteracoes`, relida quando o número da nota muda.)
- [x] A seção mostra número, data do cancelamento, motivo e responsável, com a mais recente primeiro.
- [x] A seção fica escondida quando a lista está vazia.
- [x] A leitura exige `canViewBilling` ou `canManageBilling`. Quem só vê o faturamento enxerga o histórico, mas não consegue registrar cancelamentos.
- [x] A seção funciona no tema claro e no escuro.
- [ ] Conferência manual no app: o título trocado no ticket 01 mostra a seção, e um título sem histórico não mostra.
