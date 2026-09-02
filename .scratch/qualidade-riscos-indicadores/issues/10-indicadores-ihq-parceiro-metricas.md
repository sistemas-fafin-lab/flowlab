# 10 — Indicadores: IHQ/Parceiro — envio, retorno e TAT por tipo

**What to build:** substitui os 4 KPIs genéricos atuais da seção "IHQ /
Parceiro" por uma tabela detalhada por tipo de exame (Interna, Externa
Bloco, Externa Bloco+Lâmina) com Laudos Liberados, Fora do Prazo, Enviados
ao Parceiro, Recebidos de Volta (fotos / amostra devolvida / total), TAT
Parceiro, TAT Interno e as duas pendências (aguardando parceiro / aguardando
laudo) — mesmo shape do design de referência
(`Flowlab_Controle_Qualidade`, commit `d78e375`,
`src/modules/qualidade/components/indicadores/IndicadoresPage.tsx`, seção
"Imuno-histoquímica").

**Atenção a não confundir**: esta seção é sobre envio/retorno de material
para um LABORATÓRIO PARCEIRO externo — conceitualmente diferente do módulo
"IHQ" já existente neste repo (`/qualidade/ihq`,
`api/_lib/qualidade/bdLabQualidade.ts` função de IHQ), que resolve o vínculo
de uma requisição de IHQ com a biópsia/peça original do mesmo paciente.
Nenhum código é reaproveitado entre os dois, mesmo com a mesma sigla — a
referência documenta isso explicitamente no cabeçalho da migration de
origem.

## Pesquisa no LIS ao vivo (2026-09-01)

Reconferido contra o MySQL de backup deste sistema:

- `exame` confirma os 3 códigos com os nomes esperados: `CodExame=6`
  "IMUNOISTOQUÍMICA INTERNA", `12` "IMUNOISTOQUÍMICA EXTERNA (BLOCO)", `13`
  "IMUNOISTOQUÍMICA EXTERNA (BLOCO+LÂMINA)" — todos com `CodExameTipo=5`.
- `evento` confirma os 3 códigos: `CodEvento=19` "Envio material parceiro",
  `56` "Concluído - Laudo em Fotos", `64` "Amostra DEVOLVIDA".
- Volume real, **escopado corretamente por `CodExame IN (6,12,13)`** (a
  contagem bruta de eventos sem esse filtro dá um número bem maior porque os
  mesmos `CodEvento` são usados por outros fluxos do LIS — não usar contagem
  não-escopada para estimar volume desta seção): 24 requisições nos últimos
  90 dias, todas `CodExame=13` no período consultado (nenhuma `6`/`12`
  recente — normal, os 3 tipos têm volume historicamente baixo e desigual
  entre si). Evento 19 (envio): 24; evento 56 (retorno laudo/fotos): 21.
  Sinal real, mas espere linhas zeradas com frequência para os tipos menos
  usados em qualquer período dado — isso é esperado, não um bug do sync.

## Schema (nova migration)

Adiciona a `qa_requisicoes`:

- `dta_envio_parceiro timestamptz`.
- `dta_retorno_laudo_fotos timestamptz`.
- `dta_retorno_amostra_devolvida timestamptz`.

Referência de definição de coluna + comentários:
`Flowlab_Controle_Qualidade`, `supabase/migrations/20260902120000_qualidade_requisicoes_ihq_parceiro.sql`
(commit `d78e375`) — pode copiar quase literal, os códigos já foram
reconferidos ao vivo acima.

## O que muda

- `api/_lib/qualidade/bdLabQualidade.ts` (`listarRequisicoesLis`):
  subqueries correlacionadas para `MIN(DtaEvento) WHERE CodEvento=19` e os
  dois eventos de retorno (`56`, `64`) — mesmo padrão das 3 subqueries já
  existentes no arquivo.
- `api/_lib/handlers/qualidade-sync-requisicoes.ts`: mapear os 3 campos
  novos.
- `src/modules/qualidade/domain/ihqParceiroIndicadores.ts`: agregação
  própria, por tipo de exame — ver
  `Flowlab_Controle_Qualidade/src/modules/qualidade/domain/ihqParceiroIndicadores.ts`
  (commit `d78e375`) para as fórmulas de `calcularTatParceiroHoras`
  (envio → primeiro retorno), `calcularTatInternoHoras` (primeiro retorno →
  liberação) e as duas pendências. Os 3 tipos são sempre mostrados
  separados, nunca somados (decisão já documentada na referência).
- `src/modules/qualidade/types.ts`: tipo de resposta bespoke (array `porTipo`
  com um item por `codExame`).
- `src/modules/qualidade/requisicoes.ts`: `buscarIndicadoresSecaoRequisicao`
  para `ihq_parceiro` seleciona `cod_exame` + os 3 campos novos.
- `IndicadoresPage.tsx`: a seção vira uma tabela (não um grid de 4 KPIs) —
  ver o componente de tabela da referência para o layout: colunas Tipo /
  Liberados / Fora do Prazo / Enviados / Recebidos (fotos/devolvida/total) /
  TAT Parceiro / TAT Interno / Pend. Parceiro / Pend. Laudo.

**Blocked by:** None — schema e LIS totalmente independentes das outras 3
seções extras.

**Status:** done

- [ ] Migration aplicada localmente e sync roda sem erro, idempotente.
- [ ] Os 3 tipos de exame aparecem sempre como 3 linhas separadas, mesmo
      quando um deles tem 0 requisições no período (não omitir a linha).
- [ ] TAT Parceiro usa o PRIMEIRO dos dois sinais de retorno (fotos ou
      amostra devolvida), não os dois somados nem uma média dos dois.
- [ ] `npx tsc --noEmit` e `npm test` sem erros novos.
