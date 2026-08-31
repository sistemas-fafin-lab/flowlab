Status: ready-for-agent
Type: task
Blocked by: 32

# Contas a Receber: bloquear baixa de título sem número da nota (exceto operadoras com NF pós-pagamento)

## Onde

- RPC `fat_registrar_baixa` (chamada pela ação de Baixa em `TitulosList.tsx` via `BaixaModal.tsx`)
- `operadoras.nf_apos_pagamento` (coluna adicionada em `supabase/migrations/20260828120000_operadoras_nf_apos_pagamento.sql`, issue 31)

## Problema

Com a issue 32, um título pode existir sem número da nota. Para operadoras que **não** têm `nf_apos_pagamento` ativado, dar baixa num título sem número da nota seria um problema real (a nota deveria existir antes do pagamento). Para operadoras com `nf_apos_pagamento = true`, título sem número no momento da baixa é o fluxo esperado — a nota só sai depois.

## O que fazer

1. Na RPC `fat_registrar_baixa` (ou onde a baixa é efetivamente registrada), antes de processar: buscar `numero_nota` do título e `nf_apos_pagamento` da operadora vinculada.
2. Se `numero_nota IS NULL` (ou vazio) **e** `nf_apos_pagamento = false`: rejeitar a baixa com uma mensagem de erro explícita (ex. "Não é possível dar baixa: título sem número da nota.").
3. Se `numero_nota IS NULL` e `nf_apos_pagamento = true`: seguir normalmente, sem bloqueio.
4. Se `numero_nota` já estiver preenchido: seguir normalmente, independente da operadora.
5. Propagar a mensagem de erro da RPC até o `BaixaModal.tsx` de forma legível (não só um erro genérico de request).

## Critérios de aceite

- Baixa de título sem número da nota, operadora sem `nf_apos_pagamento`: bloqueada, com mensagem explicando o motivo.
- Baixa de título sem número da nota, operadora com `nf_apos_pagamento`: funciona normalmente.
- Baixa de título com número da nota preenchido: funciona normalmente, independente da operadora.

## Referência

Sessão de grilling em 2026-08-31 (mesma sessão da issue 32) — decisão da rodada 1, Q1: bloquear baixa só quando a operadora não tiver `nf_apos_pagamento`, pra não contradizer a própria regra da issue 31.
