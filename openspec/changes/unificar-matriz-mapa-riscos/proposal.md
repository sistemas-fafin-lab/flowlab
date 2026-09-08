## Why

Hoje o módulo Qualidade > Riscos tem duas telas separadas: "Matriz de Riscos" (cadastro + listagem/filtro, com clique para gerenciar) e "Mapa de Riscos por Setor" (só leitura, filtrada por 1 setor). Filtrar a Matriz por setor já entrega quase a mesma informação que o Mapa, só que com mais funcionalidade — na prática o Mapa não tem utilidade própria hoje. O dono do produto pediu para fundir as duas numa única tela de auditoria bem mais rica: um heatmap de risco (Probabilidade × Severidade) em destaque, seções por setor com tabela + gráfico de incidência de ocorrências ao longo do tempo, e cor customizável por risco.

## What Changes

- Nova tela unificada em `/qualidade/riscos/matriz`, substituindo o conteúdo atual da Matriz de Riscos.
- Heatmap 5×5 (P×S) em destaque no topo: fundo em degradê por zona de risco, cada risco plotado como ponto individual (nunca agregado por célula), hover com Setor/Processo/Risco/P/S/Nível/Status, clique abre o drawer de gerenciamento do risco. Escondido por completo quando há busca de texto ou filtro de Setor ativo.
- Barra de busca (risco + processo) e select de Setor, ambos filtrando heatmap e seções ao mesmo tempo.
- Select de Ano global (ano-calendário, populado só com anos que têm dado) controlando os gráficos de incidência.
- Uma seção por Setor (só setores com pelo menos 1 risco visível), cada uma com: tabela de riscos (Processo/Risco/P/S/Score/Nível/Status/Cor) e, abaixo, um gráfico de linha com 1 série por risco mostrando a contagem mensal de Ocorrências vinculadas àquele risco no ano selecionado; o tooltip do gráfico mostra as datas exatas das ocorrências de cada mês.
- Cor por risco: nova coluna clicável na tabela, persistida no banco (visível para todos os usuários), com paleta default determinística quando não escolhida manualmente.
- **BREAKING**: rota `/qualidade/riscos/mapa` deixa de existir como tela própria e passa a redirecionar para `/qualidade/riscos/matriz`; `MapaRiscosPorSetorPage` é removida.

## Capabilities

### New Capabilities
- `riscos-visao-unificada`: tela única de auditoria de riscos — heatmap P×S, busca/filtros, seções por setor com tabela e gráfico de incidência mensal de ocorrências vinculadas, e cor customizável por risco persistida no banco.

### Modified Capabilities
(nenhuma — não há specs existentes em `openspec/specs/` para o módulo Riscos; este é o primeiro spec da área.)

## Impact

- **Frontend**: `src/modules/qualidade/components/RiscosPage.tsx` (reescrito), `RiscosDashboardPage.tsx` (remove card "Mapa por Setor"), novo componente de heatmap e novo seletor de cor em `src/modules/qualidade/components/`.
- **Dados/lógica**: `src/modules/qualidade/riscos.ts` (novas funções de incidência mensal, anos disponíveis, atualizar cor), `src/modules/qualidade/types.ts` (`RiscoDTO.cor`, remoção de `MapaRiscoLinhaDTO`), extensão retrocompatível de `LineChartMultiSerie.tsx`.
- **Banco**: migration adicionando coluna `cor` em `qa_riscos`; nenhuma policy de RLS nova (a policy de UPDATE existente já cobre).
- **Rotas**: `src/App.tsx` — `/qualidade/riscos/mapa` vira redirect.
- **Remoção**: `MapaRiscosPorSetorPage.tsx`, `buscarMapaRiscosPorSetor`, `MapaRiscoLinhaDTO`.
