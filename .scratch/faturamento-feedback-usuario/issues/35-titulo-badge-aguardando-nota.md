Status: ready-for-agent
Type: task
Blocked by: 32

# Contas a Receber: badge "Aguardando nota" para títulos sem número (exceto operadoras com NF pós-pagamento)

## Onde

- `src/modules/faturamento/components/TitulosList.tsx` — já tem o padrão de badge condicional por operadora (badge âmbar "NF após pagamento" da issue 31, usando o mapa `nfAposPagamentoPorOperadora` já montado a partir de `operadoras`)

## Problema

Com a issue 32, títulos sem número da nota podem existir. Sem nenhum sinal visual, eles tendem a passar despercebidos na listagem — mas só quando a ausência do número é de fato uma pendência (operadora sem `nf_apos_pagamento`); nas operadoras com NF pós-pagamento, não ter número ainda é o fluxo normal e não deveria parecer um alerta.

## O que fazer

1. Na renderização da linha do título em `TitulosList.tsx`, quando `numeroNota` estiver vazio/nulo **e** a operadora do título **não** tiver `nf_apos_pagamento`: mostrar um badge de alerta "Aguardando nota" (mesmo padrão visual do badge âmbar já existente).
2. Quando `numeroNota` estiver vazio/nulo e a operadora **tiver** `nf_apos_pagamento`: não mostrar esse badge (pode reaproveitar o badge "NF após pagamento" já existente, que já cobre esse caso).
3. Quando `numeroNota` estiver preenchido: nunca mostrar o badge "Aguardando nota", independente da operadora.

## Critérios de aceite

- Título sem número da nota, operadora sem `nf_apos_pagamento`: mostra "Aguardando nota".
- Título sem número da nota, operadora com `nf_apos_pagamento`: não mostra "Aguardando nota".
- Título com número da nota preenchido: nunca mostra "Aguardando nota", em nenhuma operadora.

## Referência

Sessão de grilling em 2026-08-31 (mesma sessão da issue 32) — decisão da rodada 2, Q7: badge de alerta condicionado à ausência de `nf_apos_pagamento`, pra evitar alarme falso exatamente nos casos em que a ausência de número é esperada.
