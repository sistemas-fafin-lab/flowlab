Status: done
Type: task

# Títulos: atalho de período (mês/trimestre) — referência = data de vencimento

## Onde

`src/modules/faturamento/components/TitulosList.tsx:256-271` (range livre
"Emissão de/até"), `src/modules/faturamento/hooks/useContasReceber.ts:198-199`
(`.gte/.lte('data_emissao', ...)`).

## Contexto

O período hoje é um range de datas livre, sem atalho de mês/trimestre, e
filtra por `data_emissao` (data de emissão da NF/título) — não por vencimento
nem por data de pagamento efetivo. A usuária pediu um atalho rápido de
mês/trimestre, mas o levantamento de requisitos deixou em aberto **qual data
deveria ser essa referência** (pergunta textual da própria transcrição):

> O "período" principal será filtrado por: data prevista de pagamento, data
> de emissão da NF, ou competência do faturamento?

Não dá para decidir isso por leitura de código — é escolha do setor sobre o
que "período" significa operacionalmente pra eles (ex.: "quanto recebi em
agosto" pode significar "NFs emitidas em agosto" ou "o que efetivamente
foi pago em agosto", que são coisas diferentes quando um título de julho é
pago em setembro).

## Decisão (usuário, 2026-09-03)

Referência = **data de vencimento** (`dataVencimento`/`data_vencimento`), não
emissão nem competência.

## O que fazer

Trocar a coluna filtrada em `useContasReceber.ts:199-200` de `data_emissao`
para `data_vencimento` (`.gte/.lte('data_vencimento', desde/ate)`) e
adicionar atalhos de mês/trimestre (ex.: "Este mês", "Mês passado", "Este
trimestre") em `TitulosList.tsx:256-271` que preenchem esse range.

Atenção a dois pontos que a troca de coluna expõe, não presentes com
`data_emissao`:

- `dataVencimento` é **nullable** (`types/index.ts:386`) — títulos sem
  vencimento definido não têm hoje nenhum tratamento nesse filtro (o range
  atual sobre `data_emissao`, que nunca é nula, não precisava disso). Decidir
  se esses títulos ficam de fora do range por padrão (`.gte/.lte` já os
  exclui naturalmente, já que `NULL` não compara) ou se precisam de exceção
  explícita na UI/mensagem de lista vazia (mesmo padrão da issue 27).
- Os atalhos de mês/trimestre calculam o range em cima de "hoje" (ex. "Este
  mês" = 1º ao último dia do mês corrente) — comportamento igual
  independente da coluna, só confirmando que não há ajuste extra necessário
  por causa da troca.

## Referência

Levantamento de requisitos com a usuária do setor (áudio transcrito,
2026-09-03), seção "Decisões a confirmar", item 1.

## Comments

**2026-09-03 — investigação de código (confirma as 3 opções, sem decidir):**

`TituloReceber` (`src/modules/faturamento/types/index.ts:379-400`) já expõe
os três candidatos a campo de referência, então nenhum exige schema novo:

- `dataEmissao: string` — sempre preenchida (comportamento atual).
- `dataVencimento: string | null` — pode ser nula (títulos sem vencimento
  definido); `diasAtraso` já é calculado em cima dela
  (`useContasReceber.ts:121`, `diasDeAtraso(linha.data_vencimento)`).
- `competencia: string | null` — texto livre tipo `"2026-08"`, também
  nullable; confirma que virar atalho por competência exigiria seletor de
  competência(s), não range de data (como a issue já previa).

O filtro em si é resolvido inteiramente no servidor via Supabase
(`useContasReceber.ts:199-200`, `.gte/.lte('data_emissao', desde/ate)`) —
trocar a coluna de referência é uma troca de nome de coluna nesse mesmo
`query`, não uma reestruturação. Isso não resolve a pergunta de negócio (qual
data o setor quer), só confirma que a implementação em qualquer uma das 3
respostas é de baixo esforço técnico — o bloqueio real é mesmo a decisão do
setor.

**2026-09-03 — implementado:**

`useContasReceber.ts`: `.gte/.lte` trocado de `data_emissao` para
`data_vencimento`. Título sem vencimento (nullable) fica fora de qualquer
range por padrão — `NULL` não compara em `gte/lte`, sem exceção explícita na
UI (opção mais simples das listadas no "O que fazer", consistente com a
mensagem de lista vazia já existente da issue 27, que só trocou "emissão" por
"vencimento" no texto).

`TitulosList.tsx`: label do range vira "Vencimento de/até"; adicionados três
atalhos ("Este mês", "Mês passado", "Este trimestre") que preenchem
`desde`/`ate` com o 1º e o último dia do período em cima de "hoje"
(`utils/formato.ts: periodoEsteMes/periodoMesPassado/periodoEsteTrimestre`).
Não precisou de mudança nos atalhos por causa de nenhum ajuste extra de
comportamento — item já estava confirmado no comment anterior.
