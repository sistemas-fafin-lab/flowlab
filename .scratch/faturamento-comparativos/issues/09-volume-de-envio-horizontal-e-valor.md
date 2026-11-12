# 09: Volume de envio por convênio na horizontal e com valor (R$)

**What to build:** no bloco "Volume de envio por convênio" da aba Comparativos (`ComparativosPage.tsx`), trocar as barras verticais por **barras horizontais agrupadas**, no estilo do Explorador do Painel de Indicadores, e incluir a medida **Valor (R$)**. Pedido da usuária ("Comparativo dos convênios enviados"; grilling de 12/11/2026).

**Blocked by:** 03

**Status:** done (12/11/2026)

## Decisões

- O nome do convênio fica no eixo vertical, com 3 barras por convênio (referência, M-1 e M-2) nas cores que o bloco já usa.
- O gráfico é ordenado pelo mês de referência e mostra os **15** convênios de maior volume (antes eram 12). A ordem segue a medida que estiver selecionada.
- A altura do gráfico cresce com o número de convênios, para os nomes não se sobreporem.
- O alternador passa a ser **Guias | Lotes | Valor**. Valor = `SUM(fatrequisicaoprocedimento.ValorLiquido)` das requisições dos lotes, a mesma regra do `VlrLote` do apLIS (`api/_lib/faturamento/bdLab.ts:680`). Ele usa o mesmo universo de lotes de hoje (data de criação e mesmos status), e é formatado em R$ no eixo e no tooltip.
- A tabela de detalhe ganha a coluna Valor em cada mês.

## Critérios

- [x] O gráfico é horizontal, tem 15 convênios e é legível com nomes longos (ex.: "PMDF - MEDICINA LABORATORIAL").
- [x] Valor por convênio e mês bate com a soma do `VlrLote` dos mesmos lotes no apLIS.
- [x] O teste da rota cobre o novo campo; `npm test` e typecheck passam.

## Comments

12/11/2026: implementada.

- Consulta: `listarVolumeEnvioMensal` (`api/_lib/faturamento/bdLab.ts`) calcula guias e valor por lote em subconsultas e só depois soma por convênio e mês, para o JOIN das guias não multiplicar o valor. Valor = `SUM(fatrequisicaoprocedimento.ValorLiquido)` das requisições do lote, a mesma expressão da coluna `Valor` de `SQL_LISTA` (`VlrLote`).
- Conferência no banco (ago–out/2026, 65 linhas convênio × mês): lotes e guias iguais aos da consulta antiga, e o valor igual à soma do `VlrLote` de cada lote, com 0 divergências. A consulta leva ~1,5 s. Totais: ago R$ 372.359,02, set R$ 903.080,07, out R$ 1.042.383,48.
- Gráfico: usa `BarrasHorizontaisPorConvenio` (o mesmo da conversão). `conveniosDoGraficoDeVolume` (`utils/comparativos.ts`) escolhe os 15 de maior volume no mês de referência, na medida selecionada. A tabela continua listando todos, ordenados pelo total de guias dos 3 meses.
- Nomes longos: o rótulo do eixo passou de 28 para 40 caracteres, e o eixo de 190 para 250 px, nos dois gráficos. No banco, os nomes mais longos são "SUL AMERICA COMPANHIA DE SEGURO SAÚDE" (38) e "Medigest Centro de Medicina Digestiva" (37); antes eles eram cortados.
- R$: no eixo, `formatMoedaCompacta` ("R$ 18,5 mil"); no tooltip e na tabela, `formatCurrency`. Os dois estão em `utils/formato.ts`.
- Testes: `comparativos.test.ts`, `formato.test.ts` e o teste da rota passam. `npm test` passa (207 arquivos, 2576 testes). O typecheck só aponta erros que já existiam: 25 em `MindMapNodes.tsx`/`ITProjectMindMap.tsx` e 8 em testes de `api/_lib/apoio`.
- Não conferido no navegador.
