# Faturamento: feedback do usuário (dashboard, faturas, contas a receber, glosas)

Status: planejado — Fases 1 e 2 prontas para execução; Fase 3 aguarda insumos externos (Mapa de Pagamento das Operadoras e documento de Glosas e Recursos).

Spec resultante de sessão de grilling em 2026-08-18, a partir do relatório de análise do setor de faturamento. Cada item vira uma issue própria em `issues/`.

## Contexto

O setor de faturamento avaliou o flowlab positivamente (centraliza o que hoje vive em planilhas) e listou melhorias em 4 áreas: Dashboard, Faturas, Contas a Receber e Glosas e Recursos. Durante o grilling foram levantados fatos direto nos dados do apLIS (consultas read-only ao backup via `api/_lib/faturamento/bdLab.ts`) que fundamentam as decisões abaixo.

## Decisões já tomadas (grilling session)

- Um único spec com fases; issues 1:1 com os itens do feedback.
- Item 6 (reclassificar glosa × negativa de autorização × procedimento não autorizado) fica **estacionado** aguardando o documento específico de Glosas e Recursos; o contexto de eventos do apLIS está registrado em "Fora de escopo".
- Itens 2.1 (previsão de pagamento por operadora) e 2.5 (NFs pendentes de pagamento por convênio) **aguardam o Mapa de Pagamento das Operadoras** antes de abrir issues. O widget de previsão atual permanece como está até lá.
- **AMHP-DF** = fonte pagadora `IdInstituicao 1025` (o catálogo de regras de prazo usa a chave `AMH`). As exceções de protocolo duplicado (3.1) e de aviso "sem envio" (4) usam esse id.
- **PARTICULAR** = fonte pagadora `IdInstituicao 1102` (ativa no apLIS).
- Recebimento por requisição vem de `fatrequisicaoprocedimento.ValorRecebido`/`DtaRecebido` (populados; `ValorCobrado` nunca é preenchido).
- Pendente de recebimento = `ValorRecebido < ValorLiquido` (cobre glosa integral, VR=0), com `CodEventoFatur` (`RECEBIDO` etc.) como sinal auxiliar — alinhado à planilha do setor.
- "Não faturada" = lote apLIS sem NF/RPS (`fatlote.IdRPS` nulo) em status ativos (1, 2, 3, 6, 7), criado até o fim de M-2 (ex.: em agosto, jan–jun sem NF = pendência); verificação fina por requisição via `NFeReq`/`RPSReq` do export.
- Particulares pendentes = fonte 1102 + evento de laudo liberado (CodEvento 11, 56, 16, 1000, 9, 19 — regra da subtab "recebido" que o setor usa hoje) + sem NF.
- Top 10 motivos de glosa mantém a fonte atual (glosas do flowlab); ampliar 8 → 10 + breakdown por operadora via `glosas.nota_id → notas.operadora_id`.
- Protocolo duplicado (3.1): badge + filtro, sem bloqueio de operação; exceção AMHP-DF.
- Guias com `ValorRecebido = 0` (glosa integral) deixam de aparecer como recebidas — a exibição passa a usar os valores do apLIS.
- Novas áreas: widgets-resumo no dashboard + aba "Pendências" em Contas a Receber (híbrido).

## Entrega em fases

### Fase 1 — Investigações + ajustes rápidos do dashboard

1. Investigar divergência faturado × recebido no dashboard (e guias R$0 como "recebidas") — issue 01.
2. Investigar lotes "Prejuízo" ausentes na "pesquisa personalizada" (item 3.3) — issue 02.
3. Exceção AMHP-DF no aviso "sem envio" (Títulos – Aberta) — issue 03.
4. Investigar número de NF "semelhante" entre os status de títulos — issue 04.
5. Widget top 10 motivos de glosa com breakdown por operadora (item 2.2) — issue 05.
6. Widget valor faturado por convênio (item 2.3) — issue 06.

### Fase 2 — Pendências e faturas

7. Aba "Pendências": requisições não faturadas (janela M-2) (item 2.4) — issue 07.
8. Aba "Pendências": particulares sem NF emitida (item 2.6) — issue 08.
9. Recebimento por requisição no lote "Recebido - parcial" (itens 3.2 e 3.2b) — issue 09.
10. Sinalizar lotes com protocolo de envio duplicado, exceto AMHP-DF (item 3.1) — issue 10.
11. Widgets-resumo das novas pendências no dashboard — issue 11 (bloqueada por 07 e 08).
12. Vínculo NF → lote → requisição do Aplis no Títulos (item 5) — issue 12.

### Fase 3 — Aguardando insumos externos (sem issues ainda)

- **2.1 Previsão de pagamento por operadora**: reconciliar o widget atual com o Mapa de Pagamento das Operadoras quando ele for encaminhado.
- **2.5 NFs pendentes de pagamento por convênio**: área específica baseada no Mapa de Pagamento.
- **Item 6 Glosas e Recursos**: reclassificação aguardando o documento específico do setor.

## Issues

- `issues/01-investigar-divergencia-faturado-recebido.md` — research
- `issues/02-investigar-prejuizo-pesquisa-personalizada.md` — research
- `issues/03-excecao-amhp-sem-envio.md` — task
- `issues/04-investigar-nf-semelhante-entre-status.md` — research
- `issues/05-dashboard-top10-motivos-glosa-convenio.md` — task
- `issues/06-dashboard-valor-faturado-convenio.md` — task
- `issues/07-pendencias-requisicoes-nao-faturadas.md` — task
- `issues/08-pendencias-particulares-sem-nf.md` — task
- `issues/09-lote-parcial-recebimento-por-requisicao.md` — task
- `issues/10-lotes-protocolo-duplicado.md` — task
- `issues/11-dashboard-widgets-pendencias.md` — task (bloqueada por 07 e 08)
- `issues/12-titulos-vinculo-nf-lote-requisicao.md` — task

## Fora de escopo (parked)

- **Item 6 — reclassificação de glosas**: aguardando o documento específico de Glosas e Recursos. Contexto registrado para o documento futuro: a classificação (glosa × negativa de autorização × procedimento não autorizado × ocorrência administrativa) pode usar os eventos do apLIS — `CodEvento` (tabela `evento`) 57 (Aguarda autorização do convênio), 58 (Aguarda resolução de não conformidade), 1021 (Amostra Pendente de PGTO.), 1036 (Autorização para o Laboratório LAP), 1040 (Requisição para pagamento no particular — rótulo com typo no banco: "Requsição"), 1041 (Requisição criada para faturamento, ativo; o 1049 é inativo), 1022 (FAT. EXTERNO), 1039 (APENAS PARA FATURAMENTO DA SULAMERICA), 1008 (FATURAMENTO ENCERRADO) — além de `CodEventoFatur` (tabela `eventofatur`: 1 AGUARDANDO FATURAMENTO, 2 FATURAMENTO EM PROGRESSO, 3 AGUARDANDO RE-FATURAMENTO, 5 RECEBIDO, 6 GLOSADO ainda SEM RECURSO, 7 RECURSO DE GLOSA - 1º RECURSO, 8 GLOSA DEFINITIVA - ACATADA DIRETORIA, 11 CONCILIAÇÃO - AGUARDANDO, 14 AGUARDANDO CARÊNCIA, 15 RECURSO NÃO ACATADO) e `IdMotivoGlosa`/`DesMotivoGlosa` (ex.: 1702 = COBRANÇA DE PROCEDIMENTO EM DUPLICIDADE; 2902 = GLOSA MANTIDA). Esses valores foram verificados no banco e estão documentados no export que o setor usa (projeto csv-filter, `filtros.md`; schema em `import_files/schema-backup-banco.csv`).
- **Itens 2.1 e 2.5**: retomados quando o Mapa de Pagamento das Operadoras chegar.
- **Preencher `DtaEnvio` no apLIS** (não é escopo do flowlab; a exceção AMHP-DF cobre o sintoma).
