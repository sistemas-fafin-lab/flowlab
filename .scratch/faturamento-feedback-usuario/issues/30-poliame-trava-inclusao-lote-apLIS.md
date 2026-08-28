Status: needs-info
Type: research

# Requisições de Poliame e outras clínicas travam a inclusão em lote

## Problema

Relato do quarto relatório do setor (27/08): "há requisições para a Poliame e
algumas clínicas que, devido às regras da fonte pagadora, o sistema trava e
não permite a inclusão em lote. Como devemos proceder nesses casos?"

## Investigado em 27/08 — provável fora do escopo do flowlab

`Poliame` existe no apLIS como fonte pagadora (`IdInstituicao` 1040 e 1105,
verificado direto no banco). Mas **criar lote / incluir requisição em lote é
uma operação do sistema legado (apLIS), não do flowlab**: `bdLab.ts` só faz
leitura (`SELECT`) contra o apLIS — não há nenhum `INSERT`/`UPDATE` em
`fatlote` ou tabela relacionada no código do flowlab (confirmado por busca no
arquivo). A única criação de lote/título que o flowlab faz é a de **título**
Supabase (`fat_criar_titulo`, `NovoTituloModal`), que agrupa lotes que **já
existem** no apLIS — não cria nem edita lote nenhum lá.

Ou seja, "o sistema trava ao incluir em lote" muito provavelmente descreve o
apLIS (tela legada/desktop), não uma tela do flowlab — não há como reproduzir
nem corrigir isso no código deste repositório.

## O que fazer

- Confirmar com o setor: essa trava acontece na tela do apLIS legado (não no
  flowlab)? Se sim, é uma questão para o suporte/desenvolvimento do apLIS,
  fora do escopo deste projeto — o flowlab não tem como intervir numa
  operação de escrita que não faz.
- Se, ao contrário, a trava acontece **dentro do flowlab** (ex.: ao tentar
  agrupar um lote da Poliame num título novo via `NovoTituloModal`), preciso
  de reprodução (print do erro, ou passo a passo) — não achei nenhuma
  validação por fonte pagadora no fluxo de criação de título que explicasse
  um travamento.

## Critérios de aceite

- Confirmar em qual sistema (apLIS legado vs. flowlab) a trava acontece antes
  de qualquer investigação de código adicional.

## Referência

Quarto relatório de feedback do setor de faturamento (27/08).
