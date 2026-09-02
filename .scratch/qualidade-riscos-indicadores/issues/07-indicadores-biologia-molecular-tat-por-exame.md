# 07 — Indicadores: Biologia Molecular — TAT médio por tipo de exame

**What to build:** na seção "Biologia Molecular" da aba Indicadores
(`/qualidade/indicadores`), abaixo dos 4 KPIs já existentes (Requisições,
Laudos liberados, TAT médio, Laudos fora do prazo), um gráfico de barras
horizontais quebrando o TAT médio por tipo de exame (PCR vs. Captura
Híbrida) — mesmo componente `BarChartHorizontal` já usado em "Indicadores
Gerais" (`src/modules/qualidade/components/IndicadoresPage.tsx`).

Esta é a fatia mais barata da Fase 2: **nenhuma migration, nenhum campo novo
do LIS**. `qa_requisicoes` já guarda `exame_tipo_nome_lis` (sincronizado
desde a migration base, `20260901120000_qualidade_requisicoes_indicadores.sql`)
e as datas de coleta/liberação já usadas pelo TAT geral — só falta agrupar
por `exame_tipo_nome_lis` em vez de tirar uma média única da seção inteira.

Referência de implementação: `Flowlab_Controle_Qualidade`, commit `d78e375`,
`src/modules/qualidade/domain/biologiaMolecularIndicadores.ts` — função
`calcularTatPorTipoExame`. **Copiar só a lógica de agrupamento**, não a
função inteira: aquele arquivo assume o formato `RequisicaoDTO` de um fetch
bruto único (arquitetura que este repo não usa — ver `requisicoes.ts` daqui,
que faz uma query por seção). Adapte para o formato que
`agregarBiologiaMolecular`/`agregarIndicadorSecao`
(`src/modules/qualidade/domain/requisicoesIndicadores.ts`) já recebem.

## O que muda

- `src/modules/qualidade/domain/biologiaMolecularIndicadores.ts`: nova
  função `calcularTatPorTipoExame` (agrupa por `exameTipoNomeLis`, reaproveita
  o cálculo de TAT por linha já existente em `requisicoesIndicadores.ts`).
- `src/modules/qualidade/types.ts`: novo tipo de resposta específico para
  Biologia Molecular (não reaproveita mais o genérico
  `IndicadorSecaoRequisicaoResposta` — ver issue 08 para o mesmo padrão nas
  outras seções).
- `src/modules/qualidade/requisicoes.ts`: `buscarIndicadoresSecaoRequisicao`
  já seleciona `exame_tipo_nome_lis`? Conferir — se não, adicionar à query de
  `biologia_molecular`.
- `IndicadoresPage.tsx`: a seção Biologia Molecular deixa de usar o
  componente genérico `SecaoExtra` (que assume o formato de 4-KPIs
  compartilhado pelas 4 seções extras) e vira um bloco bespoke, no mesmo
  padrão já usado pela seção "Indicadores Gerais" nesta página.

**Blocked by:** None — sem migration, sem novo campo do LIS, pode começar
imediatamente.

**Status:** done

- [ ] Gráfico mostra TAT médio (dias) separado por `PCR` e `CAPTURA
      HÍBRIDA`, ordenado por volume de laudos liberados (maior primeiro).
- [ ] Tipo de exame sem nenhum laudo liberado no período não aparece no
      gráfico (em vez de barra zerada).
- [ ] `npx tsc --noEmit` e `npm test` sem erros novos.
