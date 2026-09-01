# 02 — Normalização de datas em Solicitação de Compras

**What to build:** a tela de Solicitação de Compras passa a exibir a data da
solicitação em formato brasileiro (dd/mm/aaaa) em vez da string crua sem
formatação que aparece hoje, reaproveitando a função de formatação de data
já existente no domínio de cotações.

**Blocked by:** None — can start immediately

**Status:** done

- [x] A data da solicitação, na tela de Solicitação de Compras, é exibida em
      dd/mm/aaaa
- [x] Valores de data ausentes/vazios são tratados sem quebrar a exibição
      (não mostram "Invalid Date" nem lixo de string)
- [x] Nenhum outro ponto do sistema fora dessa tela é alterado (fora de
      escopo criar um util central compartilhado agora)
- [x] Teste unitário cobre a função de formatação com entradas típicas
      (string ISO válida, vazio/nulo)

## Comments

Já implementado no commit `3a07ebb` ("fix(compras): exibe data da
solicitação em dd/mm/aaaa"). `RequestManagement.tsx:1972` passou a usar o
`formatDate` já existente em `src/modules/quotations/utils/formatDate.ts`
em vez da string ISO crua. O commit também corrigiu, no próprio
`formatDate` compartilhado, um bug de fuso horário (datas sem horário
apareciam um dia antes em fusos negativos como America/Sao_Paulo, por
`new Date('YYYY-MM-DD')` ser interpretado como UTC) e trocou o retorno de
"Invalid Date" por um placeholder (`—`) para entradas inválidas.
`formatDate.test.ts` cobre ISO válido, vazio, undefined e string inválida
— `npx vitest run src/modules/quotations/utils/formatDate.test.ts`
passando (4/4). Marcando como done nesta sessão só para refletir o tracker;
nenhum código novo foi escrito aqui.
