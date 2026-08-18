Status: ready-for-agent
Type: task

# Faturas: lotes "Prejuízo" somem por causa do período padrão do filtro (item 3.3)

## Onde

Não há feature "pesquisa personalizada" no flowlab. Prejuízo = STLOT 8 (`STLOT_LABELS` em `src/modules/faturamento/types/index.ts:70-80`); o FaturasDashboard oferece filtro de status com todas as 8 opções (`FaturasDashboard.tsx:40-43`), busca livre por texto (`:317-326`) e período presets/custom (`:290-299`). Nada no código exclui o status 8 explicitamente — mas o filtro de período é aplicado em conjunto com o de status.

## Achado (verificado no banco real em 2026-08-18)

Existe **apenas 1 lote** com `Status = 8` (Prejuízo) em todo o banco: `IdLote 5005`, `DtaCriacao` 11/02/2026, fonte pagadora `IdFontePagadora 1009`. Hoje (18/08/2026) esse lote tem ~6 meses — fora dos presets padrão de período (30/90 dias, mês atual). Ou seja: **não há bug de exclusão por status** (confirmado no código também) — o lote simplesmente cai fora do período quando o usuário navega com o preset padrão, dando a impressão de que "prejuízo não aparece". Não achamos evidência de que o feedback se referia à tela legada do apLIS; o comportamento observado é inteiramente explicado pelo flowlab.

## O que fazer

1. Quando o filtro de status = "Prejuízo" (8) estiver selecionado, ignorar o preset de período padrão (mostrar todos os lotes prejuízo independente da data, a menos que o usuário também escolha um período customizado). Prejuízo é um status de baixa frequência e sem prazo natural — não deveria depender do período para aparecer.
2. Alternativa mais simples, se a opção 1 não for desejada: ao filtrar por período + status juntos, indicar visualmente quando o período ativo pode estar escondendo lotes de status raros (ex.: aviso "existem lotes Prejuízo fora do período selecionado").

## Critérios de aceite

- O lote 5005 (ou qualquer lote Prejuízo futuro) aparece ao filtrar por status "Prejuízo", mesmo com o preset de período padrão ativo.

## Referência

Feedback do setor, item 3.3.
