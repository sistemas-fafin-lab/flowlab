Status: wontfix
Type: research

# Investigar: filtro "Todas" (operadora) mostra NFs fora do período selecionado, inclusive R$0,00 como "Recebido"

## Onde

`src/modules/faturamento/components/TitulosList.tsx:224-236` (filtro "Operadora", opção `{ value: '', label: 'Todas' }`) + `hooks/useContasReceber.ts:134-202` (monta a query: `.gte('data_emissao', desde).lte('data_emissao', ate)` sempre aplicado; `.eq('operadora_id', operadoraId)` só se `operadoraId` truthy; `.eq('status', status)` só se `status` truthy; busca livre via `.or(condicoes.join(','))` quando `busca` preenchido).

## Problema

Feedback do setor (item 4.1, aba Títulos/Aberta): com o filtro de operadora em "Todas", aparecem NFs antigas fora do período (`desde`/`ate`) e do convênio selecionados, inclusive registros marcados como "Recebido" mas com valor R$ 0,00 no campo correspondente.

"Todas" aqui é o valor vazio do filtro de **Operadora** (não é status — não existe opção "Todas" no filtro de Status). Pela leitura do código, `desde`/`ate` são aplicados incondicionalmente na query (`.gte`/`.lte`), então não é óbvio por que registros fora desse intervalo apareceriam. Hipóteses a checar:

1. Interação entre o filtro de busca livre (`busca`, campo texto) e os filtros de data/operadora — checar se o `.or(condicoes...)` do Supabase/PostgREST está de fato sendo ANDed com os `.gte`/`.lte` anteriores, ou se alguma condição da busca livre inclui um campo que reabre o filtro de data.
2. Estado do filtro de data não sendo aplicado de fato quando operadora = "Todas" — checar se `onFiltrar` ou algum efeito reseta `desde`/`ate` nesse caminho.
3. Registros "Recebido" com `valor_recebido = 0,00` — checar a trigger/RPC de recálculo de status (`fat_recalcular_nota`, `supabase/migrations/20260807120000_contas_receber.sql:177-238`) pra ver se existe caminho em que o status vira "recebida" sem valor lançado (ex.: baixa de R$0 registrada por engano, ou status não recalculado após alguma operação).

## O que investigar

1. Reproduzir com dado real: aplicar filtro de operadora "Todas" + um período restrito e conferir se de fato aparecem títulos com `data_emissao` fora do intervalo.
2. Se reproduzir, isolar se a causa é a busca livre, o estado do filtro de data, ou algo na query/RPC.
3. Conferir os títulos "Recebido" com valor R$0,00 mencionados — achar exemplos concretos (como fizeram as issues 01/04) e checar `valor_recebido`/`status` desses registros.

## Critérios de aceite (após virar fix)

- Com filtro de operadora "Todas" e um período selecionado, só aparecem títulos com `data_emissao` dentro do período.
- Não aparecem títulos "Recebido" com `valor_recebido = 0,00` sem explicação (ou a causa raiz é outra e a issue é revisada).

## Referência

Novo relatório de feedback do setor de faturamento (24/08), item 4.1.

## Comments

Investigação de implementação (24/08): nenhuma das 3 hipóteses se sustenta no código atual.

1. **Interação busca × data/operadora**: `useContasReceber.ts:191-192` aplica `.gte('data_emissao', desde)` e `.lte('data_emissao', ate)` incondicionalmente, ANTES de qualquer filtro condicional. O `.or(condicoes...)` da busca livre (linha 218) só toca `numero_nota`/`competencia`/`observacoes`/`operadora_id.in` — em PostgREST/supabase-js um `.or()` é ANDed com os filtros já encadeados (`.gte`/`.lte`/`.eq`), nunca os substitui ou os OR'a. Não há caminho para um `data_emissao` fora do intervalo passar.
2. **Estado do filtro de data resetado com operadora vazia**: `aplicarFiltro` em `ContasReceberPage.tsx:103-105` só faz merge do patch recebido de `onFiltrar`; não há efeito nenhum ligando `operadoraId` a um reset de `desde`/`ate`. `TitulosList.tsx` também não reseta datas em lugar nenhum.
3. **"Recebido" com valor_recebido = 0,00**: `fat_recalcular_nota` (`20260807120000_contas_receber.sql:223-230`) só atribui status `'recebida'` quando `v_total > 0 AND v_recebido >= v_total` — como ambos são `DECIMAL(15,2)`, isso exige `v_recebido >= 0,01`. Nem `fat_registrar_baixa` nem as RPCs de criação de título escrevem `status` diretamente; ele é sempre derivado pela trigger a partir das baixas/glosas reais. Não existe caminho de aplicação (baixa, glosa, criação de título) que produza esse estado hoje — só seria possível em dado legado/seed anterior à trigger, nunca recalculado por falta de qualquer baixa real (mesmo achado da issue 01: produção com "5 notas de seed, 0 baixas reais" em 18/08).

Sem acesso a dado real para reproduzir (a única service_role key em `.env` é de um projeto Supabase diferente do que o frontend usa para ler `notas` — `VITE_SUPABASE_URL` aponta para `jqxeqmeikqclmmongclj`, a key de servidor é de `eqzqkztgzcngnxmihdom`), e sem nenhuma hipótese sustentável no código atual, fechando como `wontfix` — mesmo padrão da issue 14. Reabrir se o setor reproduzir de novo com exemplo concreto (número da nota, período aplicado, operadora), como as issues 01/04 fizeram.
