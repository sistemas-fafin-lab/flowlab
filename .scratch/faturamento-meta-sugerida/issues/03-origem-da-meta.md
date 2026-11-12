# 03: Origem da meta gravada e exibida

**What to build:** ao salvar a meta, o sistema grava também de onde ela veio: `90_10`, `media_2`, `media_3` ou `manual`. O card **Meta** mostra a origem da meta do mês. Assim fica registrado se a meta seguiu um critério ou foi decidida à mão.

**Blocked by:** 02 (Opções no modal "Definir meta").

**Status:** ready-for-agent

- [ ] `metas_faturamento` ganha a coluna `origem`, nula, restrita aos quatro valores. A migration é idempotente, como as anteriores.
- [ ] As linhas existentes (setembro e outubro/2026) ficam com `origem` nula, e o card não mostra origem para elas.
- [ ] Salvar uma opção sem mudar o valor grava a origem dela.
- [ ] Mudar o valor de uma opção selecionada, ou digitar um valor, grava `manual`.
- [ ] As políticas RLS atuais de insert e update continuam valendo, sem permissão nova.
- [ ] O card mostra a origem da meta salva ("90/10", "Média de 2 meses", "Média de 3 meses" ou "Manual").
- [ ] `npm test` e o typecheck passam.
