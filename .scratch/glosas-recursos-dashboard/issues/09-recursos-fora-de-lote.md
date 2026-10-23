# 09: Sub-aba "Recursos fora de lote"

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** a sub-aba "Recursos fora de lote" lista as requisições do período que não estão em nenhum lote de recurso: as de status 6 (selo "glosado sem recurso") e as de status 7 ou 16 (selo "em recurso sem lote"). Para cada uma, mostra o prazo para recorrer (regra Glosa – Recurso, contada da data de recebimento da requisição) e o selo de atraso. Serve também para a responsável conferir a limpeza dos lotes de 2026.

**Blocked by:** 03, 05

**Status:** done

- [x] As colunas são as mesmas de Glosas recentes: data da glosa, guia, paciente, convênio, procedimento, motivo e valor glosado. Somam-se o selo de tipo, o prazo para recorrer e o selo de atraso.
- [x] Respeita o período e o convênio do cabeçalho, com busca e paginação.
- [x] Convênio sem regra mostra "—" no prazo.
- [x] O olho abre o card "Detalhes do recurso" direto na requisição.

## Notas da implementação

- **Dados novos na foto** (migration `20261023190000`): `data_recebimento` (último `fatrequisicaoprocedimento.DtaRecebido`, a data da glosa e a base do prazo), `procedimentos` e `motivos` (`TEXT[]`, 'código descrição', do catálogo `fatmotivoglosa`). Procedimento glosado = com motivo de glosa ou recebido abaixo do líquido. Conferido na réplica em 23/10/2026: a data de recebimento é a mesma em todos os procedimentos da requisição (2 de 2.304 em status 6 divergem; nenhuma em 7/16). Fotos anteriores ficam com esses campos vazios até a próxima sincronização do mês.
- **Leitura:** `GET /api/faturamento/glosas-recursos-fora-de-lote` (competencia, fontePagadoraId, busca, pagina, tamanho), sobre a view nova `glosa_recurso_requisicoes_lista` (foto + coluna `busca`: guia, paciente, convênio, procedimento, requisição, motivo), pensada para a issue 10 reaproveitar. Filtra `id_lote_recurso IS NULL` e status 6, 7, 16; ordena pela data da glosa, da mais recente.
- **Prazo:** `recursoGlosa.prazoParaRecorrer(dataRecebimento, regra, hoje)` aplica a regra GLOSA – RECURSO e dá o selo; sem regra, regra "sem prazo" ou sem data de recebimento → "—". O selo saiu para `seloDoPrazo`, que `prazosDoLote` também usa.
- **Tela:** `RecursosForaDeLoteLista` com selo de tipo ("Glosado sem recurso" / "Em recurso sem lote"), prazo e selo de atraso; procedimento e motivo mostram o primeiro e "+N" (lista inteira no título). O olho abre `DetalhesRecursoCard` só com `idRequisicao`.
- Migration **não testada em banco** nem aplicada no Supabase. Sem ela, a sincronização falha (grava as colunas novas) e a sub-aba não lê.
- Revisão: a lista e o hook repetem a estrutura de `LotesRecursoLista`/`useLotesRecurso` (paginação, debounce, guarda de corrida) e a leitura das regras por fonte repete o handler de lotes; vale extrair um componente de paginação e um hook paginado quando a issue 10 trouxer a terceira cópia. A busca cobre também requisição e motivo, além do que a issue 10 pede.
