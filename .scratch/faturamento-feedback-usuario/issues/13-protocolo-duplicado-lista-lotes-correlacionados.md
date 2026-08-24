Status: done
Type: task

# Faturas: badge de protocolo duplicado não mostra quais lotes estão envolvidos

## Onde

`src/modules/faturamento/components/FaturasDashboard.tsx:538-543` — badge/tooltip do protocolo duplicado (`lote.protocoloDuplicado`, `lote.protocoloDuplicadoContagem`). Dado calculado em `hooks/useFaturamentoLotes.ts` / `api/_lib/handlers/faturamento-lotes.ts` / `api/_lib/faturamento/bdLab.ts` (issue 10).

## Problema

O tooltip hoje só mostra a contagem: `` `Protocolo duplicado em ${contagem} lotes` `` (`FaturasDashboard.tsx:540`). Não lista os lotes correlacionados — o usuário vê que há duplicidade mas precisa procurar manualmente qual é o outro lote com o mesmo protocolo pra conferir/corrigir.

## O que fazer

1. Na consulta que já detecta duplicidade (issue 10), trazer também os `IdLote` (ou código do lote) dos outros lotes do mesmo grupo de protocolo — não só a contagem.
2. No tooltip/badge, listar os números dos lotes correlacionados (ex.: "Protocolo duplicado com o(s) lote(s) 6490, 6491").
3. Se for simples, tornar cada lote da lista um link/ação que filtra a tabela por aquele lote (mesmo padrão de navegação já usado em outros pontos do módulo) — não é obrigatório para o critério de aceite, mas resolve melhor a "conferência e correção" pedida no feedback.

## Critérios de aceite

- Ao ver o badge de protocolo duplicado em um lote, dá para saber quais são os outros lotes do mesmo grupo sem sair da tela ou pesquisar manualmente.

## Fora de escopo

- Mudar a regra de detecção de duplicidade (exceção por formato de data) — já resolvida na issue 10.

## Referência

Novo relatório de feedback do setor de faturamento (24/08), item 3.1.
