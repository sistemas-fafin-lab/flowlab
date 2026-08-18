Status: ready-for-agent
Type: research

# Investigar: lotes "Prejuízo" ausentes na "pesquisa personalizada" (item 3.3)

## Onde

Não há feature "pesquisa personalizada" no flowlab. Prejuízo = STLOT 8 (`STLOT_LABELS` em `src/modules/faturamento/types/index.ts:70-80`); o FaturasDashboard oferece filtro de status com todas as 8 opções (`FaturasDashboard.tsx:40-43`), busca livre por texto (`:317-326`) e período presets/custom (`:290-299`). Nada no código exclui o status 8.

## Problema

Feedback: "na pesquisa personalizada, os lotes classificados como prejuízo não estão sendo apresentados". Provável referência à tela "pesquisa personalizada" do apLIS legado (fora do flowlab) — a confirmar.

## O que investigar

1. Confirmar com quem reportou se a tela é do apLIS ou do flowlab; pedir exemplo concreto de lote prejuízo não encontrado.
2. Se for o flowlab: reproduzir com o filtro status 8 + período (ex.: presets Mês/30/90 podem excluir lotes antigos) e corrigir o que falhar.
3. Se for o apLIS: registrar como fora de escopo e encerrar a issue.

## Referência

Feedback do setor, item 3.3. Lotes prejuízo têm `fatlote.Status = 8`; nenhum filtro atual os exclui.
