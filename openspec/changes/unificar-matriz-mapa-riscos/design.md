## Context

O módulo Qualidade > Riscos já tem toda a base de dados e componentes necessários: `qa_riscos` (cadastro, P/S/score/nível/tratamento), `qa_riscos_ocorrencias` (correlação N:N com Ocorrências), `RiscoDetalheDrawer`/`NovoRiscoDrawer` (gerenciamento/cadastro), `TabelaExpansivel` (tabela genérica com filtro/ordenação), e uma lib de gráficos SVG própria em `src/modules/qualidade/components/ui/charts/` (`LineChartMultiSerie.tsx`, `BarChartHorizontal.tsx`, `DonutChart.tsx` — sem recharts, que é convenção de outros módulos, não deste). A fusão reaproveita tudo isso; o trabalho novo é composição de UI (heatmap, seções por setor, seletor de cor) e duas queries de agregação novas (incidência mensal, anos disponíveis).

## Goals / Non-Goals

**Goals:**
- Uma única tela em `/qualidade/riscos/matriz` cobrindo cadastro, listagem/filtro, visão de auditoria por setor e análise temporal de incidência.
- Reaproveitar 100% dos componentes/queries existentes que já resolvem cadastro, detalhe e correlação — nenhuma duplicação de lógica de negócio.
- Heatmap e gráfico de incidência seguindo o mesmo padrão visual (SVG puro, tema light/dark) já estabelecido no módulo.

**Non-Goals:**
- Não redesenhar `RiscoDetalheDrawer`, `NovoRiscoDrawer` nem a lógica de correlação risco↔ocorrência — são reaproveitados tal como estão.
- Não introduzir uma lib de gráficos externa (recharts ou outra).
- Não migrar cor para preferência por-usuário (localStorage) — é compartilhada no banco, por decisão de produto.
- Não classificar/mapear os demais setores fora dos que já têm risco cadastrado (setores vazios ficam ocultos, não é escopo criar dado de exemplo).

## Decisions

1. **Cor do risco: coluna nova em `qa_riscos`, não `qa_parametros`.** `qa_parametros` é chave/valor com `chave text PRIMARY KEY` — uma linha por chave, sem precedente de "uma chave por registro dinâmico" (`cor:<riscoId>`) em nenhum outro ponto do módulo. Uma coluna dedicada é o padrão já usado pelo resto do schema (`tratamento`, `probabilidade` etc.) e não exige policy de RLS nova — `qa_riscos_update` já cobre qualquer UPDATE via `canManageQualidade`.

2. **Incidência mensal via `qa_riscos_ocorrencias` (N:N), não via `buscarOcorrenciasCorrelacionadas`.** A função pública mistura a correlação N:N com a origem 1:N (`ocorrencia_origem_id`) para exibição no drawer de detalhe (evita linha duplicada na UI de correlação). Para o gráfico, isso é desnecessário: `criarRisco()` já grava o vínculo N:N automaticamente quando o risco nasce de uma ocorrência (`riscos.ts:163`), então `qa_riscos_ocorrencias` sozinha já é superset suficiente. Uma query batched (`'risco_id, ocorrencia:qa_ocorrencias(dta_ocorrencia)'` com `.in('risco_id', ids)`) evita N+1 mesmo com muitos riscos visíveis.

3. **Filtro de texto client-side, não novo campo em `RiscoFiltro`.** `listarRiscos` já filtra `nivel` no client depois do fetch porque é campo derivado (score + faixas configuráveis). Busca por texto segue o mesmo padrão: busca tudo (ou tudo do setor, se filtrado) e filtra `riscoIdentificado`/`processo` em memória — evita adicionar filtro `ilike` combinado no servidor para um volume de dados que já cabe numa única página.

4. **Heatmap: pontos individuais dispersos, não células agregadas.** P e S são 1-5 (25 células possíveis) e podem existir vários riscos por célula. Agregar em uma célula colorida exigiria uma segunda interação (lista → escolha) para hover/clique; plotar cada risco como ponto disperso (jitter determinístico por posição dentro do grupo da célula) mantém hover/clique 1:1 sem ambiguidade, ao custo de posições não serem "a célula exata" visualmente (ficam dentro da área da célula, não centralizadas).

5. **`LineChartMultiSerie` estendido, não forkeado.** Adicionar `detalhes?: string[]` opcional em `PontoSerieLinha` (para a lista de datas no tooltip) é retrocompatível — o único outro consumidor (`DashboardPage.tsx`, gráfico de cortesias por autorizador) não passa esse campo e não muda de comportamento. Forkar o componente duplicaria ~300 linhas de SVG por uma diferença pequena no tooltip.

6. **Nenhum color-picker de terceiros.** Não existe componente de seleção de cor no projeto hoje; em vez de adicionar uma dependência nova, usa-se `<input type="color">` nativo (suportado em todos os browsers modernos) + swatches da paleta default para clique rápido — zero dependência nova, consistente com a filosofia "sem lib externa" do resto do módulo de gráficos.

## Risks / Trade-offs

- **[Risco] Muitos riscos no mesmo setor tornam o gráfico de linha poluído (muitas séries/cores).** → Mitigação: `LineChartMultiSerie` já teve esse problema resolvido para cortesias (rótulo direto só até 4 séries, tabela alternativa via botão "Ver tabela") — mesmo mecanismo cobre o caso de um setor com muitos riscos.
- **[Risco] Clique na bolinha de cor dentro de uma linha da tabela poderia acionar também o clique da linha (abrir o drawer).** `TabelaExpansivel` aplica `onClick` no `<tr>` inteiro, sem isolar célula. → Mitigação: o botão da bolinha de cor chama `e.stopPropagation()` explicitamente.
- **[Risco] Jitter dos pontos do heatmap pode posicionar dois riscos muito próximos em telas pequenas, prejudicando o clique individual.** → Mitigação: raio mínimo de separação fixo entre pontos do mesmo grupo, independente do tamanho da tela (SVG com `viewBox` responsivo já normaliza isso).
- **[Trade-off] Remover `/qualidade/riscos/mapa` é uma mudança BREAKING para quem tenha o link salvo.** → Mitigação: rota vira redirect (`<Navigate>`) em vez de 404, então links antigos continuam funcionando.

## Migration Plan

1. Aplicar a migration (`ALTER TABLE qa_riscos ADD COLUMN cor text`) — aditiva, sem dado a migrar, sem downtime.
2. Deploy do frontend com a tela nova; rota `/mapa` já redireciona a partir do mesmo deploy (sem etapa intermediária de "aviso de depreciação").
3. Rollback: reverter o deploy do frontend (a coluna `cor` pode continuar existindo sem uso, não precisa reverter a migration).

## Open Questions

Nenhuma — todas as decisões de produto foram fechadas com o usuário antes deste documento (heatmap, filtros, seções, gráfico, cor, permissões).
