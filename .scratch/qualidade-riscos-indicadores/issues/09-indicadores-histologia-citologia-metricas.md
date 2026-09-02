# 09 — Indicadores: Histologia/Citologia — métricas ricas (blocos/lâminas, tempo de processamento, qualidade de amostra)

**What to build:** substitui os 4 KPIs genéricos atuais da seção
"Histologia / Citologia" por: Blocos Produzidos, Lâminas Produzidas, Tempo
de Processamento (recebimento → 1ª lâmina pronta), Amostras Não Recebidas,
Material Devolvido Não Conforme, Microscopia Aguardando (**movida da
Patologia/AP — ver correção abaixo**), e — com ressalva de baixo valor —
Lâminas Inadequadas / Amostras Insatisfatórias. Mesmo shape do design de
referência (`Flowlab_Controle_Qualidade`, commit `d78e375`,
`src/modules/qualidade/components/indicadores/IndicadoresPage.tsx`, seção
"Histologia/Citologia"), com uma correção baseada em dado real deste LIS.

## Pesquisa no LIS ao vivo (2026-09-01)

Reconferido contra o MySQL de backup deste sistema (mesma conexão do
`.env`, usada pelo sync em produção):

| Indicador | Fonte | Volume real | Vale implementar? |
|---|---|---|---|
| Blocos/Lâminas Produzidos | `bloco`/`lamina.DtaCriacao` via `blocorequisicao`/`laminarequisicao` | 14.928 blocos e 11.675 lâminas nos últimos 90 dias | **Sim** — volume alto, sinal forte |
| Microscopia Aguardando | `CodEvento=1000` ("Microscopia - Aguarda Liberação") | 2.681 requisições nos últimos 90 dias, **100% em `CITOPATOLOGIA`** | **Sim** — mas é desta seção, não de Patologia/AP (ver abaixo) |
| Amostras Não Recebidas | `CodProblema=4` ("Amostra não recebida") | 139 nos últimos 365 dias, última ocorrência 2026-08-31 (ativo) | **Sim** |
| Material Devolvido Não Conforme | `CodProblema=27` | 60 em todo o histórico, 5 nos últimos 365 dias, última ocorrência 2026-03-09 | **Sim, mas baixa frequência esperada** |
| Lâminas Inadequadas | `CodProblema IN (20,37,41,42)` | **20 e 41: 0 registros em todo o histórico do LIS. 37: 1 registro (2024-08-01). 42: não consultado, mas nenhum apareceu na busca ampla de 90/365 dias** | Praticamente morto — confirmar com o time antes de implementar |
| Amostras Insatisfatórias | `CodProblema IN (10,17)` | **10: 0 registros em todo o histórico. 17: 1 registro (2023-12-18)** | Praticamente morto — confirmar com o time antes de implementar |

**Correção importante em relação à referência**: lá, "Microscopia
Aguardando" era um indicador de Patologia/AP (issue 08). A consulta ao vivo
mostrou que, neste LIS, o evento `CodEvento=1000` é usado quase
exclusivamente para requisições de `CITOPATOLOGIA` (2681/2681 nos últimos 90
dias, 0 em `ANÁTOMO PATOLÓGICO`) — por isso este indicador foi realocado
para esta seção. Não copiar a alocação de seção da referência sem
reconferir contra o LIS de destino se este trabalho for portado para outro
ambiente.

**Antes de implementar Lâminas Inadequadas / Amostras Insatisfatórias**: 3
dos 5 `CodProblema` envolvidos nunca foram usados neste LIS (histórico
completo, não só período recente) e o quarto tem 1 registro em ~2 anos.
Isso sugere que a equipe operacional não usa essas categorias de problema no
dia a dia (loga de outra forma, ou o fluxo não se aplica) — implementar do
jeito que a referência fez provavelmente entrega dois KPIs sempre zerados.
Considerar pular esses dois indicadores nesta fase, ou confirmar
explicitamente com o time antes de gastar o ciclo.

## Schema (nova migration)

Adiciona a `qa_requisicoes`:

- `num_blocos integer NOT NULL DEFAULT 0`, `num_laminas integer NOT NULL DEFAULT 0`.
- `dta_primeira_lamina_pronta timestamptz`.
- `dta_microscopia_aguardando timestamptz` (**realocado da Patologia/AP —
  não confundir com a coluna homônima que a referência colocou na migration
  de lá**).
- `amostra_nao_recebida boolean NOT NULL DEFAULT false` + `dta_amostra_nao_recebida timestamptz`.
- `material_devolvido_nao_conforme boolean NOT NULL DEFAULT false` + `dta_material_devolvido timestamptz`.
- Opcional (ver ressalva de baixo valor acima): `lamina_inadequada`/`dta_lamina_inadequada`, `amostra_insatisfatoria`/`dta_amostra_insatisfatoria`.
- Reaproveita `bloco_danificado`/`dta_bloco_danificado` da issue 08 para
  "Blocos Inadequados" — mesma ressalva de baixo volume (1 registro em todo
  o histórico) se aplica aqui.

Referência de definição de coluna + comentários (fonte, não copiar
literalmente por causa da correção da microscopia):
`Flowlab_Controle_Qualidade`, `supabase/migrations/20260901120000_qualidade_requisicoes_histologia_citologia.sql`
(commit `d78e375`).

## O que muda

- `api/_lib/qualidade/bdLabQualidade.ts` (`listarRequisicoesLis`): adicionar
  contagem de blocos/lâminas produzidos (join com `blocorequisicao`/
  `laminarequisicao`, filtrando por `DtaCriacao` no período — ver
  `SQL_BLOCOS_PRODUZIDOS`/`SQL_LAMINAS_PRODUZIDAS` em
  `Flowlab_Controle_Qualidade/api/_lib/qualidade/bdLabRequisicoes.ts`,
  commit `d78e375`, para a query de referência — ali é uma query separada,
  não subquery correlacionada, por causa do `GROUP BY`/`COUNT`);
  subquery para `MAX(DtaEvento) WHERE CodEvento=1000`; subqueries/joins para
  `requisicaoproblema.CodProblema IN (4, 27, ...)`.
- `api/_lib/handlers/qualidade-sync-requisicoes.ts`: mapear os campos novos.
- `src/modules/qualidade/domain/histologiaCitologiaIndicadores.ts`:
  agregação própria — ver
  `Flowlab_Controle_Qualidade/src/modules/qualidade/domain/histologiaCitologiaIndicadores.ts`
  (commit `d78e375`) para as fórmulas, adaptando: mover
  `contarMicroscopiaAguardando` pra cá (vinha de `patologiaIndicadores.ts`
  na referência).
- `src/modules/qualidade/types.ts`: tipo de resposta bespoke.
- `src/modules/qualidade/requisicoes.ts`: `buscarIndicadoresSecaoRequisicao`
  para `histologia_citologia` seleciona as colunas novas.
- `IndicadoresPage.tsx`: bloco bespoke (sai do `SecaoExtra` genérico).

**Blocked by:** 08 (reaproveita a coluna `bloco_danificado` de lá para
"Blocos Inadequados") — só para esse indicador específico; o resto desta
issue é independente e pode ser implementado mesmo que 08 ainda não tenha
rodado, desde que a migration desta issue também declare
`bloco_danificado`/`dta_bloco_danificado` com `ADD COLUMN IF NOT EXISTS`
(idempotente, seguro mesmo se 08 rodar depois ou nunca rodar).

**Status:** done

- [ ] Migration aplicada localmente e sync roda sem erro, idempotente.
- [ ] Microscopia Aguardando aparece em Histologia/Citologia, não em
      Patologia/AP.
- [ ] Tempo de Processamento (recebimento → 1ª lâmina pronta) retorna `null`
      quando faltar qualquer uma das duas datas, nunca `0`.
- [ ] Decisão registrada (implementado ou pulado, com justificativa) sobre
      Lâminas Inadequadas / Amostras Insatisfatórias antes de fechar a
      issue.
- [ ] `npx tsc --noEmit` e `npm test` sem erros novos.
