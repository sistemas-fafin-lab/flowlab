Status: done
Type: task

# Títulos: atalho "Somente pendentes" como filtro rápido (padrão ligado)

## Onde

`src/modules/faturamento/components/TitulosList.tsx` (filtros),
`src/modules/faturamento/components/ContasReceberPage.tsx:62-73` (estado
inicial dos filtros), `src/modules/faturamento/hooks/useContasReceber.ts`.

## Contexto

Pedido explícito da usuária (levantamento de requisitos, 2026-09-03): quer
uma visão operacional que já venha consolidada em "o que falta receber", sem
precisar selecionar status manualmente toda vez. Hoje o filtro de Status
existe (`aberta`/`parcialmente_recebida`/`recebida`/`liquidada`/`glosada`/
`cancelada`) mas nasce vazio (sem filtro nenhum) — o usuário tem que
selecionar "Aberta" e "Parcialmente recebida" manualmente a cada visita.

## O que fazer

Adicionar um atalho/toggle "Somente pendentes" na tela de Títulos que, quando
ligado (estado inicial padrão), filtra por status `aberta` +
`parcialmente_recebida` (os dois estados que representam "falta receber").
Desligar o atalho volta ao filtro de Status manual normal (todas as opções
do enum). Não remover o filtro de Status existente — o atalho é um preset em
cima dele, não substituto.

## Critérios de aceite

- Ao abrir a tela de Títulos pela primeira vez (sem filtro salvo), a lista já
  vem restrita a `aberta`/`parcialmente_recebida`.
- Desligar o atalho mostra todos os status novamente.
- Atalho e filtro de Status manual não entram em conflito (ligar o atalho
  limpa/sobrescreve uma seleção manual anterior de Status, e vice-versa).

## Referência

Levantamento de requisitos com a usuária do setor (áudio transcrito,
2026-09-03), item "Encontrar rápido 'o que falta receber' (pendências)" —
"Atalho: Somente pendentes (padrão)".

## Comments

**2026-09-04 — status corrigido (auditoria de issues 37-46):** já estava
implementado, o `Status` no arquivo é que tinha ficado desatualizado. Todos
os critérios de aceite confirmados no código: `somentePendentes` nasce
`true` em `ContasReceberPage.tsx`, `useContasReceber.ts` aplica o preset de
status via `STATUS_TITULOS_PENDENTES` só quando não há status manual
selecionado, e `viewsSalvas.ts`/`viewsSalvas.test.ts` cobrem o conflito
atalho↔status manual nos dois sentidos (ligar um desliga o outro), inclusive
o caso de view salva antiga sem a chave `somentePendentes`.
