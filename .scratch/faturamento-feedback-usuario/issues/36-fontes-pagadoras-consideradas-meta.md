# Fontes pagadoras consideradas para meta (whitelist)

Status: done

## Contexto

Pedido direto do cliente na sessão (03/09, fora do relatório escrito): o
setor de faturamento passou uma lista fechada de 32 fontes pagadoras que
devem ser consideradas nas tabelas e no dashboard do módulo Faturamento; o
resto ("fontes pagadoras particulares" — clínicas parceiras, cortesia,
laboratórios que enviam exame pra este processar etc.) não deveria mais
aparecer.

Decisões de grilling com o usuário na sessão:
- **Whitelist**, não blacklist: só as 32 fontes marcadas "SIM" contam. Uma
  fonte nova/desconhecida no apLIS fica de fora até alguém marcar
  manualmente.
- **Conceito novo e separado** de `is_clinica_parceira` (issue 16) e
  `nf_apos_pagamento` (issue 31) — aquelas mantêm significado e escopo
  atuais.
- **Escopo**: todo o módulo Faturamento — Dashboard de Contas a Receber,
  Títulos, Pendências não faturadas, Pendências sem lote, Faturas/lotes,
  Histórico de Glosas, Recursos. Exceção deliberada: o modal de criação de
  título (`somenteSemTitulo=1` em `/api/faturamento/lotes`) NÃO aplica a
  whitelist — a cobrança de um lote de fonte fora da meta continua válida,
  só não entra no relatório de meta.

## Implementação

- `supabase/migrations/20260903110000_operadoras_considerada_meta.sql`:
  coluna `operadoras.is_considerada_meta` (default `false`), seed das 30
  fontes já sincronizadas + INSERT manual de CONAB e GAMA SAÚDE (inativas no
  apLIS, o sync nunca as traz — GAMA SAÚDE tem 2 registros com a mesma razão
  social no apLIS, ids 1343/1344, incluídos os dois por falta de elemento
  pra desambiguar).
- `supabase/migrations/20260903120000_aging_por_operadora.sql`: RPC
  `fat_dashboard_receber` passa a filtrar `notas` por
  `operadoras.is_considerada_meta = true` na raiz (`v_ids`), propagando para
  KPIs/aging/por operadora/prazos/série mensal/motivos de glosa.
- `api/_lib/faturamento/fontesConsideradas.ts` (novo): helper
  `listarFontesConsideradasMeta` — lê os `aplis_id` whitelisted do Supabase,
  cache de 60s em memória.
- `api/_lib/faturamento/bdLab.ts`: novo param `fontesConsideradas?: number[]`
  em `ListarLotesParams`, `ListarLotesPendentesParams`,
  `ListarRequisicoesSemLoteParams`, `ListarGlosasLegadoParams`,
  `ListarRecursosLegadoParams` — filtro `IN (...)` (ou `1=0` se lista vazia)
  aplicado ao lado dos filtros escalares existentes; chave de cache de cada
  função inclui a lista para não servir resultado com whitelist desatualizada.
- 5 handlers (`faturamento-lotes`, `faturamento-pendencias`,
  `faturamento-pendencias-sem-lote`, `faturamento-glosas-legado`,
  `faturamento-recursos-legado`): resolvem a whitelist via
  `listarFontesConsideradasMeta` antes de chamar bdLab.ts.
- `useContasReceber.ts`: `OperadoraResumo.consideradaMeta`; filtro sempre
  ativo (não é opção do usuário) na busca de Títulos; novo
  `marcarConsideradaMeta` (mesmo padrão UPDATE direto de
  `marcarClinicaParceira`/`alternarNfAposPagamento`).
- `ConsideradaMetaModal.tsx` (novo, cópia adaptada de
  `ClinicasParceirasModal`/`RegraNfModal`): tela de gestão da whitelist,
  aberta pela aba Títulos, gate `canManageBilling`.
- Dropdowns de fonte pagadora/operadora em `TitulosList`,
  `PendenciasNaoFaturadas`, `PendenciasSemLote` e `FiltrosReceber`
  (seleção múltipla do dashboard) passam a listar só fontes
  `consideradaMeta` — evita o operador escolher uma fonte que o backend
  devolveria vazia.

## Pendente

As migrations não foram aplicadas em produção nesta sessão: `supabase db
push` exige `--include-all` porque há migrations locais mais antigas de
outras frentes ainda não empurradas (hardware-alert, permissões de usuário,
correção de cotações etc.) — fora do escopo desta issue. Fica para quem for
publicar o próximo lote de migrations.
