# 08 — Indicadores: Patologia/AP — métricas ricas (casos atrasados, recorte/coloração, consenso, blocos refeitos)

**What to build:** substitui os 4 KPIs genéricos atuais da seção
"Patologia / Anatomia Patológica" (Requisições, Laudos liberados, TAT
médio, Laudos fora do prazo) por métricas específicas dessa seção: Casos
Atrasados (prazo operacional do setor, não o prazo ao cliente), Recorte/Nova
Coloração, Consenso Pendente e Blocos Refeitos — mesmo shape do design de
referência (`Flowlab_Controle_Qualidade`, commit `d78e375`,
`src/modules/qualidade/components/indicadores/IndicadoresPage.tsx`, seção
"Patologia / Anatomia Patológica").

## Pesquisa no LIS ao vivo (2026-09-01)

Os `CodEvento`/`CodProblema` documentados no projeto de origem
(`supabase/migrations/20260831120000_qualidade_requisicoes_patologia_ap.sql`
de lá) foram **reconferidos ao vivo contra o MySQL de backup deste sistema**
(mesma conexão `DB_HOST`/`DB_USER` do `.env`, usada pelo sync em produção) —
não foi só copiado do projeto de origem. Resultado:

| Indicador | Fonte | Catálogo confere? | Volume real (últimos 90 dias) |
|---|---|---|---|
| Casos Atrasados | `requisicao.DtaPrevistaSetor` | — (não é evento/problema) | **100% preenchido** para Anátomo Patológico (1537/1537 requisições) — seguro |
| Recorte/Nova Coloração | `CodEvento=3` ("Corte - Coloração Esp. / Novos Cortes") | confere | 81 requisições (~5% do volume de AP) — sinal real |
| Consenso Pendente | `consensodetalhe.DtaResposta IS NULL` via `consenso.IdRequisicao` | — | 283 consensos criados nos últimos 90 dias ainda sem resposta, backlog crescente (772 abertos só em 2026) — sinal real e relevante |
| Blocos Refeitos | `requisicaoproblema.CodProblema=19` ("Bloco danificado ou quebrado") | confere | **1 registro em todo o histórico do LIS, de 2022-09-15** — código praticamente morto nesta base |

**Divergência importante em relação à referência**: lá, "Microscopia
Aguardando" (`CodEvento=1000`) era um indicador desta seção
(Patologia/AP). Na consulta ao vivo, **2681 das 2681 requisições com esse
evento nos últimos 90 dias pertencem a `CITOPATOLOGIA` (CodExameTipo=2), 0 a
`ANÁTOMO PATOLÓGICO`** — ou seja, neste LIS o evento é usado para
Histologia/Citologia, não Patologia/AP. **Não implemente "Microscopia
Aguardando" aqui** — foi movido para a issue 09 (Histologia/Citologia), que
já reflete essa correção.

**Decisão a confirmar com o time antes de implementar Blocos Refeitos**: com
1 único registro em ~4 anos de histórico, esse KPI vai mostrar 0 quase
sempre. A referência decidiu mostrar o dado real mesmo assim ("decisão do
usuário: mostrar o dado real, não omitir o indicador") — mas essa decisão
foi tomada pelo time do projeto de origem, não pelo cliente deste repo.
Perguntar antes de gastar o ciclo de implementação nisso, ou implementar e
deixar claro na UI que é esperado ficar zerado na prática.

## Schema (nova migration)

Adiciona a `qa_requisicoes` (mesmo padrão ALTER da migration base — ver
`supabase/migrations/20260901120000_qualidade_requisicoes_indicadores.sql`
deste repo para o estilo de migration/RLS/comentário já em uso aqui):

- `dta_prevista_setor timestamptz` — espelho de `requisicao.DtaPrevistaSetor`.
- `recorte_coloracao boolean NOT NULL DEFAULT false` + `dta_recorte_coloracao timestamptz`.
- `consenso_pendente boolean NOT NULL DEFAULT false` + `dta_consenso_criado timestamptz`.
- `bloco_danificado boolean NOT NULL DEFAULT false` + `dta_bloco_danificado timestamptz`
  (reaproveitada pela issue 09 para "Blocos Inadequados" em
  Histologia/Citologia — mesmo campo, dois usos).

Referência de definição exata de coluna + comentários:
`Flowlab_Controle_Qualidade`, `supabase/migrations/20260831120000_qualidade_requisicoes_patologia_ap.sql`
(commit `d78e375`) — copiar o `ALTER TABLE`, adaptar ao estilo de comentário
já usado na migration base deste repo.

## O que muda

- `api/_lib/qualidade/bdLabQualidade.ts` (`listarRequisicoesLis`): a query
  hoje só puxa 3 subqueries correlacionadas por `CodEvento` (admissão,
  recebimento, retificação). Adicionar: `r.DtaPrevistaSetor` na SELECT
  principal; subquery correlacionada para `MAX(DtaEvento) WHERE CodEvento=3`
  (recorte/coloração); subquery para `consensodetalhe.DtaResposta IS NULL`
  via `consenso.IdRequisicao`; subquery para
  `requisicaoproblema.CodProblema=19`. **Ver o comentário no topo do arquivo
  sobre custo de subquery correlacionada vs. derived table agregada — testar
  contra os ~2M registros de `requisicaohistorico` antes de trocar a
  estratégia.**
- `api/_lib/handlers/qualidade-sync-requisicoes.ts`: mapear os 4 campos
  novos no upsert.
- `src/modules/qualidade/domain/patologiaIndicadores.ts`: substitui
  `agregarPatologiaAp` (hoje só chama o genérico `agregarIndicadorSecao`)
  por agregação própria — ver
  `Flowlab_Controle_Qualidade/src/modules/qualidade/domain/patologiaIndicadores.ts`
  (commit `d78e375`) para as fórmulas de `contarCasosAtrasados` (usa
  `dtaPrevistaSetor`, não `dtaPrevista`), `contarRecorteColoracao`,
  `contarConsensoPendente`, `contarBlocosRefeitos`. **Não copiar
  `contarMicroscopiaAguardando`/`pendenciasDiagnostico` daquele arquivo** —
  ver correção acima.
- `src/modules/qualidade/types.ts`: novo tipo de resposta bespoke para esta
  seção (substitui o uso do genérico `IndicadorSecaoRequisicaoResposta`).
- `src/modules/qualidade/requisicoes.ts`: `buscarIndicadoresSecaoRequisicao`
  para `patologia_ap` passa a selecionar as 4 colunas novas.
- `IndicadoresPage.tsx`: bloco bespoke (sai do componente genérico
  `SecaoExtra`), mesmo padrão da seção "Indicadores Gerais" já implementada
  nesta página.

**Blocked by:** None — schema, LIS e domínio são independentes das outras 3
seções extras (issue 09 só *reaproveita* a coluna `bloco_danificado` criada
aqui, mas pode implementar de forma independente se aplicar o mesmo
`ADD COLUMN IF NOT EXISTS`).

**Status:** done

- [ ] Migration aplicada localmente e sync de um período de teste roda sem
      erro (idempotente — rodar duas vezes não duplica nem quebra).
- [ ] Casos Atrasados usa `dta_prevista_setor`, não `dta_prevista` (são
      indicadores deliberadamente diferentes — não confundir com "Fora do
      Prazo" de Indicadores Gerais).
- [ ] Consenso Pendente é calculado pela `DtaSolicitacao` da requisição (não
      pela data de criação do consenso) — mesmo racional de janela de
      período do resto do módulo.
- [ ] Confirmado com o time se implementa Blocos Refeitos sabendo que vai
      ficar quase sempre em 0.
- [ ] `npx tsc --noEmit` e `npm test` sem erros novos.
