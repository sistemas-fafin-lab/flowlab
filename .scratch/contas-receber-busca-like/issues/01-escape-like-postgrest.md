# Escape de `%`/`_` na busca de Títulos é descartado pelo PostgREST

Status: ready-for-agent

## Onde

`src/modules/faturamento/hooks/useContasReceber.ts:164-183`, especificamente
a linha 168:

```ts
const termoLike = termo.replace(/[%_]/g, '\\$&').replace(/"/g, '\\"');
const condicoes = [
  `numero_nota.ilike."%${termoLike}%"`,
  `competencia.ilike."%${termoLike}%"`,
  `observacoes.ilike."%${termoLike}%"`,
];
...
query = query.or(condicoes.join(','));
```

## Problema

O código escapa `%`/`_` (curingas do LIKE) com `\` antes de montar as
condições do `.or()`. Mas o parser de valor citado do PostgREST
(`pQuotedValue`) trata `\` + qualquer caractere como uma sequência de escape
**da própria gramática do PostgREST** e sempre remove a barra antes de
encaminhar o valor para o Postgres. Ou seja: `\%` chega ao Postgres como `%`
puro — o escape nunca sobrevive até a cláusula `ILIKE`.

## Cenário de falha

Um operador busca por um trecho de observação que contém `%` ou `_` de
verdade — por exemplo uma nota com observação "desconto de 10%". O termo
`10%` vira `termoLike = '10\%'`, montado como
`observacoes.ilike."%10\%%"`. O PostgREST remove a barra antes de repassar
ao Postgres, que recebe `%10%%` — o `%` continua funcionando como curinga,
não como caractere literal, exatamente como se o `.replace` nunca tivesse
rodado. Na prática isso não quebra nada (a busca ainda "funciona", só
devolve resultados a mais do que o termo literal pediria), mas o comentário
na linha 166 ("`%` e `_` do operador viram curinga do LIKE; escapa antes de
compor") documenta uma garantia que o código não cumpre.

## Direções possíveis (não prescritivo)

O `.or()` do postgrest-js não expõe uma cláusula `ESCAPE` por condição, então
não dá para resolver só ajustando a string do lado do cliente. Duas rotas
plausíveis, a avaliar por quem pegar o ticket:

- Mover essa busca para uma RPC/function no Postgres, que recebe o termo cru
  e monta o `ILIKE ... ESCAPE '!'` (ou equivalente) do lado do servidor, onde
  o escape realmente é interpretado pelo motor de LIKE.
- Aceitar que `%`/`_` no termo de busca se comportem como curinga (remover a
  pretensão de escape e o comentário que a descreve), se o produto achar
  aceitável.

## Referência

Achado original: revisão `/code-review` de 2026-08-12, ao lado do refactor do
Candidato 1 da revisão de arquitetura
(`docs/architecture/oportunidades-melhoria-arquitetura.md`). Não é regressão
desse refactor — o código de busca não foi tocado nele.
