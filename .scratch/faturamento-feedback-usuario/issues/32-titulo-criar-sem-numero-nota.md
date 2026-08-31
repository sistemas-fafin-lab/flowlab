Status: done
Type: task

# Contas a Receber: criar título sem número da nota

## Onde

- `src/modules/faturamento/components/NovoTituloModal.tsx` (validação JS do campo, linhas ~180-183 e ~383-390)
- `api/_lib/handlers/faturamento-titulo-criar.ts` (validação `numeroNota`)
- RPC `public.fat_criar_titulo` (última versão em `supabase/migrations/20260819140000_fat_criar_titulo_codigo_requisicao.sql`, checagem `RAISE EXCEPTION 'Número da nota é obrigatório.'`)
- Tabela `notas` (`supabase/migrations/20260320_billing_module.sql`, coluna `numero_nota TEXT NOT NULL`)
- Exibição: `src/modules/faturamento/components/TitulosList.tsx` (linha do título) e `src/modules/faturamento/components/BaixaModal.tsx:212` (título do modal, hoje interpola `titulo.numeroNota` direto)

## Problema

Às vezes o número da nota só é emitido depois da criação do título (ex. operadoras com `nf_apos_pagamento = true`, ver issue 31). Hoje "Número da nota" é obrigatório em três camadas (formulário, API, RPC) e `NOT NULL` no banco — não dá pra criar o título antes de ter o número.

## O que fazer

1. Migration relaxando `notas.numero_nota` para aceitar `NULL` (mantém `TEXT`, sem `NOT NULL`, sem valor default).
2. Remover a checagem de obrigatoriedade do `numeroNota` nas três camadas de validação: JS em `NovoTituloModal.tsx`, validação de payload em `faturamento-titulo-criar.ts`, e o `RAISE EXCEPTION` na RPC `fat_criar_titulo`. Continuar aceitando string vazia/ausente como "sem número" (normalizar pra `NULL` na gravação, não string vazia).
3. Ajustar `TitulosList.tsx` e `BaixaModal.tsx` pra exibir um placeholder (ex. "—") no lugar do número quando `numeroNota` for `null`/vazio, em vez de mostrar `undefined` ou string vazia solta no meio do texto.
4. Não mexer em nenhuma outra regra (baixa, glosa, cancelamento) nesta issue — só criação + exibição.

## Critérios de aceite

- Salvar "Novo Título" sem preencher número da nota não gera erro em nenhuma camada (formulário, API, RPC, banco).
- Título salvo sem número da nota aparece na listagem e no modal de baixa com um placeholder claro, sem `undefined`/quebra visual.
- Criar título **com** número da nota preenchido continua funcionando exatamente como hoje.

## Referência

Sessão de grilling em 2026-08-31, pedido direto do usuário: poder criar título em Contas a Receber sem o número da nota e completar depois. Ver issue 31 (regra de NF antes/depois do pagamento por operadora) — esta issue é o pré-requisito que fecha a lacuna identificada lá (operadoras `nf_apos_pagamento=true` hoje são obrigadas a inventar um número pra conseguir criar o título).

## Comments

Implementado em 31/08/2026:

- Migration `20260831120000_notas_numero_nota_opcional.sql` remove o `NOT NULL` de `notas.numero_nota`.
- Migration `20260831130000_fat_criar_titulo_numero_nota_opcional.sql` recria `fat_criar_titulo` sem o `RAISE EXCEPTION`, gravando `NULLIF(p->>'numeroNota', '')` (string vazia normalizada para `NULL`, nunca gravada como `''`).
- `faturamento-titulo-criar.ts` não exige mais `numeroNota` na lista de validação; o campo já cai para `undefined` (não string vazia) via o helper `texto()` existente.
- `NovoTituloModal.tsx`: removida a validação client-side que bloqueava o submit sem número; label deixou de ter `*` e o texto de apoio agora explica que é opcional.
- `TitulosList.tsx` e `BaixaModal.tsx` (e `ContasReceberPage.tsx`, não listado no ticket mas quebraria com `numeroNota: string | null`) mostram um placeholder neutro no lugar do número ausente, sem badge/alerta — o badge de alerta condicionado a `nf_apos_pagamento` é escopo da issue 35.
- `TituloReceber.numeroNota` (types/index.ts) e `LinhaTitulo.numero_nota` (useContasReceber.ts) passaram a `string | null`.
- `npm run test` (224 testes) e `tsc --noEmit` sem novos erros; `/code-review medium` sem achados.
