## 1. Banco de dados

- [x] 1.1 Criar migration `supabase/migrations/20260908090000_qualidade_riscos_cor.sql`: `ALTER TABLE qa_riscos ADD COLUMN IF NOT EXISTS cor text;` + `COMMENT ON COLUMN`
- [x] 1.2 Confirmar que a policy `qa_riscos_update` existente cobre a coluna `cor` sem ajuste (não criar policy nova)
- [ ] 1.3 Aplicar a migration no ambiente de desenvolvimento e conferir a coluna criada

## 2. Tipos e camada de dados (`src/modules/qualidade/`)

- [x] 2.1 `types.ts`: adicionar `cor: string | null` em `RiscoDTO`; remover `MapaRiscoLinhaDTO`
- [x] 2.2 `riscos.ts`: incluir `cor` em `SELECT_RISCO`, `LinhaBrutaRisco` e `mapearRisco`
- [x] 2.3 `riscos.ts`: implementar `atualizarCorRisco(riscoId: string, cor: string | null): Promise<void>`
- [x] 2.4 `riscos.ts`: implementar `buscarAnosComOcorrenciaRisco(): Promise<number[]>` (via `qa_riscos_ocorrencias` join `qa_ocorrencias.dta_ocorrencia`, anos distintos, sistema todo)
- [x] 2.5 `riscos.ts`: implementar `buscarIncidenciaMensalPorRiscos(riscoIds: readonly string[], ano: number): Promise<Map<string, PontoSerieLinha[]>>` (query batched, agregação em memória por risco/mês, 12 pontos completos por risco)
- [x] 2.6 `riscos.ts`: remover `buscarMapaRiscosPorSetor`
- [x] 2.7 `rotulos.ts`: adicionar `COR_NIVEL_HEX` (mapa hex paralelo a `BADGE_NIVEL`), `PALETA_COR_RISCO_DEFAULT` e `corDoRisco(risco: RiscoDTO)` (hash determinístico do id → paleta default quando `cor` é `null`)

## 3. Componente de gráfico existente

- [x] 3.1 `LineChartMultiSerie.tsx`: adicionar `detalhes?: string[]` opcional em `PontoSerieLinha`
- [x] 3.2 `LineChartMultiSerie.tsx`: guardar o ponto inteiro (não só `y`) na estrutura interna usada pelo tooltip, e renderizar a lista de `detalhes` (se houver) abaixo da contagem no tooltip
- [x] 3.3 `LineChartMultiSerie.tsx`: tornar o `aria-label` do `<svg>` uma prop opcional (default = texto atual), para não descrever incorretamente o novo uso em Riscos
- [x] 3.4 Confirmar que `DashboardPage.tsx` (único outro consumidor) continua funcionando sem alteração

## 4. Heatmap (componente novo)

- [x] 4.1 Carregar a skill `dataviz` antes de escrever qualquer código deste item
- [x] 4.2 Criar `src/modules/qualidade/components/ui/charts/HeatmapMatrizRisco.tsx` (SVG puro, mesmo estilo de `LineChartMultiSerie.tsx`/`BarChartHorizontal.tsx`, tema light/dark via prop)
- [x] 4.3 Implementar grade fixa 5×5 com fundo em degradê por faixa de classificação (`buscarFaixasClassificacao`)
- [x] 4.4 Implementar agrupamento de riscos por célula (P,S) e dispersão determinística (jitter) dos pontos dentro da célula, com raio mínimo de separação
- [x] 4.5 Implementar hover (tooltip com Setor/Processo/Risco/P/S/Nível/Status) e clique (`onClicarPonto(riscoId)`) por ponto

## 5. Seletor de cor (componente novo)

- [x] 5.1 Criar `src/modules/qualidade/components/riscos/SeletorCorRisco.tsx`: botão-bolinha (cor de fundo = cor atual) + popover com `<input type="color">` nativo e swatches de `PALETA_COR_RISCO_DEFAULT`
- [x] 5.2 Garantir `e.stopPropagation()` no clique do botão, para não disparar o `onClickLinha` da linha da tabela
- [x] 5.3 Gatear interatividade por `canManage` (via `useCanManageQualidade`) — sem permissão, renderizar só a bolinha estática
- [x] 5.4 Conectar `onMudar` a uma mutation que chama `atualizarCorRisco` e invalida a query `['riscos', ...]`

## 6. Página unificada

- [x] 6.1 Reescrever `src/modules/qualidade/components/RiscosPage.tsx`: estado de `busca`, `setorId`, `ano`, `novoAberto`, `detalheId`
- [x] 6.2 Query de riscos filtrada por `setorId` no servidor e por `busca` (risco + processo) no client, seguindo o mesmo padrão já usado para o filtro de `nivel`
- [x] 6.3 Query de anos disponíveis (`buscarAnosComOcorrenciaRisco`) com seleção automática do ano default (mais recente com dado, ou ano atual) só na primeira carga
- [x] 6.4 Query de incidência mensal (`buscarIncidenciaMensalPorRiscos`) para os riscos visíveis + ano selecionado
- [x] 6.5 Agrupar riscos visíveis por Setor em memória, ordenados alfabeticamente; setores sem risco visível não geram Seção
- [x] 6.6 Renderizar heatmap condicionalmente (`!busca && !setorId`), passando os riscos completos (não filtrados) e `onClicarPonto` abrindo o drawer
- [x] 6.7 Renderizar barra de busca + select de Setor + select de Ano
- [x] 6.8 Renderizar uma Seção por Setor: título, `TabelaExpansivel` (colunas Processo/Risco/P/S/Score/Nível/Status/Cor, `onClickLinha` abre o drawer) e `LineChartMultiSerie` logo abaixo (1 série por risco do setor, cor via `corDoRisco`)
- [x] 6.9 Manter botão global "Cadastrar novo risco" (reaproveita `NovoRiscoDrawer` sem mudanças)
- [x] 6.10 Remover o link/botão "Mapa por setor" do cabeçalho da página

## 7. Rotas e navegação

- [x] 7.1 `src/App.tsx`: trocar o `element` da rota `/qualidade/riscos/mapa` por `<Navigate to="/qualidade/riscos/matriz" replace />`; remover o import de `MapaRiscosPorSetorPage`
- [x] 7.2 `RiscosDashboardPage.tsx`: remover o card "Mapa por Setor" e o import `Map as MapIcon` (se ficar sem outro uso no arquivo); atualizar a descrição do card "Matriz de Riscos"
- [x] 7.3 `index.ts`: remover o export de `MapaRiscosPorSetorPage`

## 8. Remoção de código morto

- [x] 8.1 Deletar `src/modules/qualidade/components/MapaRiscosPorSetorPage.tsx`
- [x] 8.2 Rodar grep por `MapaRiscoLinhaDTO`, `buscarMapaRiscosPorSetor` e `MapaRiscosPorSetorPage` para confirmar que não sobrou nenhuma referência fora de `.scratch/`/histórico

## 9. Verificação

- [x] 9.1 `npx tsc --noEmit -p tsconfig.json` sem erros novos
- [x] 9.2 `npx tsc --noEmit -p api/tsconfig.json` sem erros novos
- [x] 9.3 `npx vitest run src/modules/qualidade` — todos os testes passando (considerar teste unitário para `corDoRisco`/hash determinístico)
- [ ] 9.4 `npm run dev`: heatmap aparece sem filtro e some ao buscar/filtrar por setor; clique no heatmap e clique na linha da tabela abrem o mesmo drawer; troca de cor reflete no gráfico; `/qualidade/riscos/mapa` redireciona para `/qualidade/riscos/matriz` — **PARCIAL**: confirmado que os 3 arquivos novos/alterados compilam sem erro via Vite (dev server já rodando em :5174); passo interativo completo (clique/hover/login) não verificado neste ambiente — falta `chromium-cli` e credenciais de teste, e a migration da tarefa 1.3 ainda não foi aplicada no banco (a página vai dar erro 42703 ao selecionar a coluna `cor` até isso ser feito). Verificação manual do usuário necessária depois de aplicar a migration.
