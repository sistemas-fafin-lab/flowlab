Status: done
Type: task

# Faturas: recebimento por requisição no lote "Recebido - parcial"

## Onde

`api/_lib/faturamento/bdLab.ts` (`SQL_DETALHE` `:498-525`; `detalharLote` `:620-624`), handler `api/_lib/handlers/faturamento-lote-detalhe.ts`, `src/modules/faturamento/components/FaturasDashboard.tsx` (expansão do lote), tipos em `src/modules/faturamento/types/index.ts` e, se aplicável, `TitulosList.tsx` (guias congeladas).

## Problema

O flowlab nunca leu `ValorRecebido`/`DtaRecebido` do apLIS. Hoje "recebida" vem do status da nota/lote, então guias glosadas integralmente (`ValorRecebido` = 0) aparecem como recebidas. Verificado no banco: requisição 0100024943007 (lote 6108) — líquido 94,51, recebido 0,00, glosa 1702 ("COBRANÇA DE PROCEDIMENTO EM DUPLICIDADE"), `CodEventoFatur` 6 (GLOSADO ainda SEM RECURSO).

## Regra (decidida no grilling)

- Pendente = `ValorRecebido < ValorLiquido` por procedimento (inclui VR = 0 → glosa integral); valor pendente = `ValorLiquido - ValorRecebido`.
- Sinal auxiliar: `requisicao.CodEventoFatur` (tabela `eventofatur`: 5 = RECEBIDO; 6 = GLOSADO ainda SEM RECURSO — as requisições-exemplo desta spec estão em 6), alinhado à planilha do setor.
- `ValorCobrado` não é confiável (só ~3,8% dos procedimentos de 2026 têm valor; `ValorRecebido` ~59%) — usar `ValorRecebido`/`DtaRecebido`.

## O que fazer

1. `SQL_DETALHE`/`detalharLote`: incluir `ValorRecebido`, `DtaRecebido`, `CodEventoFatur` (e descrição via tabela `eventofatur`) por procedimento/requisição.
2. No lote "Recebido - parcial" (STLOT 7), o drill-down mostra apenas requisições pendentes (VR < VL), com valor pendente e motivo de glosa; recebidas ficam ocultas/colapsadas.
3. Guias com VR = 0 deixam de ser exibidas como recebidas; passam a pendente/glosada.
4. Atualizar tipos (`types/index.ts`) e demais consumidores do detalhe.

## Critérios de aceite

- No lote 6108, a requisição 0100024943007 aparece como pendente (R$ 94,51 pendente, glosa 1702), não como recebida.
- No lote 6075, as requisições aparecem com o valor recebido × pendente por procedimento.
- Lotes totalmente recebidos não listam pendências.
