Status: done
Type: research

# Esclarecer qual campo deveria "filtrar as nfs"

## Onde

Hipótese mais provável: `src/modules/faturamento/components/NovoTituloModal.tsx`
(campos do rodapé — Número da nota / Emissão / Competência / Vencimento /
Observações — batem exatamente com os do print). Alternativa:
`FiltrosReceber.tsx:569-580` (campo "Notas fiscais", busca por pílulas em
`notas.numero_nota` via Supabase).

## Problema

Relato: "Nesse campo não é possível filtrar as nfs", com print mostrando um
formulário com "Número da nota", "Emissão", "Competência", "Vencimento",
"Observações" — que corresponde ao formulário de **criação** de título
(`NovoTituloModal`), não a um filtro. Esse formulário não filtra nada: o
"Número da nota" ali é o número que o operador está digitando para o título
NOVO que está criando, não uma busca.

Duas leituras possíveis, nenhuma confirmável só por código:

1. O setor está de fato no `NovoTituloModal` e esperava poder **buscar/filtrar
   lotes já com NF** (ex.: para conferir um título já criado) — mas esse modal
   só lista lotes **sem título** (`somenteSemTitulo=1`), então não tem como
   aparecer NF ali por design; pode ser uma confusão sobre o que essa tela faz
   ou uma feature nova de fato (abrir um título existente por número de NF).
2. O setor está descrevendo outra tela e o print foi o exemplo errado — o
   campo real que deveria filtrar por NF já existe em
   `FiltrosReceber.tsx` ("Notas fiscais", busca parcial com sugestões via
   `notas.numero_nota`) e nesse caso a pergunta é se ESSE campo não está
   funcionando.

## O que fazer

- Pedir ao setor: em qual tela exatamente ele tentou "filtrar as nfs" — Novo
  Título, Contas a Receber (Títulos) ou o painel de Filtros (ícone de funil)?
  O print sozinho não permite diferenciar sem mais contexto (breadcrumb da
  tela não aparece no recorte).
- Se for (2), testar o campo "Notas fiscais" do `FiltrosReceber` fim a fim
  (`buscarNotasSugeridas` lê de `notas.numero_nota` no Supabase — mesma
  ressalva de volume baixo de dado das issues 01/05/06/12: se não há notas
  reais cadastradas, a busca não vai sugerir nada, o que pode parecer "não
  funciona").

## Critérios de aceite

- Identificar a tela e o campo exatos antes de qualquer mudança de código.

## Confirmado em 27/08 — tela é NovoTituloModal, campo é data-entry, não filtro

Usuário confirmou: os campos são "número da nota", "emissão", "competência" e
"vencimento" — bate exatamente com `NovoTituloModal.tsx:378-410`, hipótese 1.
Fechada a dúvida de tela; é o formulário de **criação** de título, não um
filtro/busca de nada.

Lido o componente inteiro (`NovoTituloModal.tsx`): `numeroNota` (estado do
campo "Número da nota") só é usado em `submeter` (`:186-193`) — nunca entra em
`carregar`/`params` (`:101-134`), que é quem busca a lista de lotes acima do
formulário. Ou seja, digitar ali **não filtra nada por design**: é o número da
NF que o operador está atribuindo ao título novo que está criando, não uma
busca. O único campo que filtra a lista de lotes é "Buscar por operadora,
paciente, guia…" (`:233-242`), que não busca por NF — e nem poderia: essa
lista só traz lotes **sem** título (`somenteSemTitulo=1`), que por definição
ainda não têm NF nenhuma.

**Duas leituras do que o usuário queria, ambas plausíveis**:
1. Confundiu o propósito da tela — achou que "Número da nota" filtrava a
   lista de lotes abaixo (posição/aparência de filtro), quando na verdade é
   um campo de entrada pro título que ele está prestes a criar.
2. Queria uma capacidade que **não existe**: buscar/abrir um título já criado
   a partir do número da NF (útil pra achar rápido um título existente sem
   navegar pela lista de Títulos) — isso seria feature nova, não bug.

## Decisão necessária (produto, não técnica)

Não é mais uma pergunta de "qual tela" — é uma decisão de escopo:
- **(a)** Só esclarecer a UX (label/placeholder deixando claro que é o número
  da NF do título novo, não uma busca) — baixo esforço, resolve a confusão de
  leitura (1).
- **(b)** Construir de fato uma busca de título existente por número de NF
  (nesta tela ou na lista de Títulos) — endereça (2), mas é feature nova, fora
  do escopo de "bug reportado".

## Decidido em 27/08 — ambas

Produto optou por endereçar as duas leituras:

- **(a) feito nesta issue**: `NovoTituloModal.tsx` ganhou um heading visível
  ("Dados do título que você está criando") separando a seção de criação da
  lista de lotes acima, e o campo "Número da nota" ganhou placeholder +
  texto de apoio ("Número da NF deste título novo — não filtra a lista
  acima") deixando explícito que não é busca.
- **(b) desmembrado**: registrado como feature nova na issue 25
  (`25-buscar-titulo-existente-por-numero-nf.md`), fora do escopo de "bug
  reportado" — precisa confirmação do setor antes de implementar.

## Referência

Novo relatório de feedback do setor de faturamento (27/08).
