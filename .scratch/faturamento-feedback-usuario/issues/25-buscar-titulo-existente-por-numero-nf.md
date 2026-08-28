Status: needs-triage
Type: feature

# Buscar/abrir título já existente por número de NF

## Origem

Desmembrada da issue 24 em 27/08. A issue 24 investigou o relato "não é
possível filtrar as nfs" e concluiu que o campo apontado pelo usuário
(`NovoTituloModal.tsx`, "Número da nota") é um campo de **criação** de
título, não uma busca — comportamento correto por design (ver issue 24 para
o histórico completo da investigação).

Ao decidir o escopo, o produto optou por endereçar as duas leituras
possíveis do relato: (a) esclarecer a UX do campo existente — feito direto
na issue 24 — e (b) esta feature nova, registrada aqui.

## Problema

Não existe hoje nenhuma forma de localizar um título **já criado** a partir
do número da NF. O único caminho é navegar pela lista de Títulos em Contas a
Receber e localizar visualmente. Se o setor tem esse hábito (achar
rapidamente um título existente digitando a NF), falta esse campo de busca.

## O que fazer

- Confirmar com o setor se essa capacidade é de fato desejada (a issue 24
  não confirmou a leitura 2, só registrou como hipótese plausível).
- Se confirmado, avaliar onde faz mais sentido: um campo de busca por NF na
  lista de Títulos (`TitulosList.tsx`/`ContasReceberPage.tsx`, seguindo o
  padrão do campo "Notas fiscais" em `FiltrosReceber.tsx`), ou um atalho
  separado.
- `notas.numero_nota` já é a coluna correta para essa busca (mesma usada por
  `buscarNotasSugeridas` em `FiltrosReceber.tsx`) — não deveria exigir nova
  coluna/índice além do que já existe.

## Critérios de aceite

- Confirmação do setor sobre a necessidade antes de qualquer implementação
  (hoje é hipótese, não requisito confirmado).
- Se confirmado: dado um número de NF já atribuído a um título existente, o
  usuário consegue localizar/abrir esse título sem navegar manualmente pela
  lista completa.

## Referência

Novo relatório de feedback do setor de faturamento (27/08). Ver issue 24
para o histórico completo da investigação que originou esta issue.

## Comments

**Novo relato, mesmo dia (quarto relatório, 27/08)**: "Ao acessar a tela de
Notas Fiscais, o sistema não cria um novo título/campo para realizar
pesquisas. Preenchi algo incorreto?" — mesma confusão de tela/campo já
registrada aqui, reforçando que o setor genuinamente quer/espera esse tipo de
busca.

**Achado importante**: a capacidade pedida **já existe, parcialmente**.
`TitulosList.tsx:286-295` tem um campo de busca livre visível direto na tela
de Títulos ("Buscar por nota, operadora, competência, observações…"), que
filtra por `numero_nota` via `ilike` (`useContasReceber.ts:199-218`) — ou
seja, já dá pra achar um título existente digitando a NF, sem precisar de
feature nova. Esse campo está sujeito à mesma pegadinha do período padrão das
issues 20/27 (se o período não cobrir o título, a busca não acha nada).

Isso muda o escopo desta issue: não é mais claramente "falta a capacidade",
pode ser "a capacidade existe mas não foi descoberta" — o setor pode estar
testando em `NovoTituloModal` (campo de criação, não busca — issue 24) em vez
do campo de busca da lista de Títulos. Antes de construir qualquer coisa nova,
vale confirmar com o setor se o campo "Buscar por nota…" da lista de Títulos
já resolve, com um período que cubra o título procurado. Se resolver, esta
issue fecha como esclarecimento de UX (talvez só reforçar a descoberta desse
campo), não como feature nova.
