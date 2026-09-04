Status: done
Type: feature

# Título: ação para vincular/desvincular lote depois de criado

## Onde

`src/modules/faturamento/components/TitulosList.tsx` (expansão mostra
lotes/guias, sem ação de editar vínculo), `EditarTituloModal.tsx` (só edita
`numeroNota`, não lotes).

## Contexto

O modelo de dados já suporta N lotes por título (um título expande em
múltiplos lotes — visto na expansão de `TitulosList.tsx`), o que responde a
uma das perguntas em aberto do levantamento ("1 NF pode vincular vários
lotes/títulos, ou é sempre 1:1?"): **já é N:1 (vários lotes por título) por
arquitetura atual**, decidido na criação do título. O que falta é uma ação
para alterar esse vínculo **depois** de criado — hoje não existe edição de
lotes de um título já existente, só na hora de criar.

## Perguntas para triagem

- Qual o caso de uso concreto: corrigir um lote incluído por engano, ou
  adicionar um lote que só ficou pronto depois que o título já tinha sido
  emitido?
- Alterar os lotes de um título já com baixa registrada deveria ser
  bloqueado (mudaria o valor total e invalidaria a baixa) ou permitido só
  antes de qualquer recebimento?
- Isso precisa de auditoria (motivo/responsável), como a issue 44 propõe
  para outras exceções, dado que muda o valor total de uma NF já emitida?

## O que fazer (após triagem)

Nova ação em `TitulosList.tsx` (ex. "Editar lotes") que permite
adicionar/remover lotes de um título existente, respeitando as regras de
bloqueio definidas na triagem, e recalculando o valor total do título
(mesmo trigger `fat_recalcular_nota` que já existe para baixas).

## Referência

Levantamento de requisitos com a usuária do setor (áudio transcrito,
2026-09-03), ação "Vincular/alterar lote" e "Decisões a confirmar" item 3.

## Resolução (2026-09-04)

Triagem respondida pelo usuário:

- Caso de uso: só correção de erro (remover um lote incluído por engano).
  "Vincular" (adicionar lote depois) fica fora de escopo — sem caso de uso
  confirmado.
- Bloqueio: se o título já tem baixa registrada, a edição de lotes é
  **bloqueada por completo** (não há caminho de "permitir com confirmação").
- Auditoria: motivo obrigatório, mesmo padrão da issue 44.

Implementado como `fat_desvincular_lote` (RPC SECURITY DEFINER,
`20260904100000_fat_desvincular_lote.sql`), que remove o vínculo `nota_lote`,
recalcula `valor_total` do título e grava a auditoria (`notas_lote_audit_logs`)
na mesma transação. Rejeita: motivo vazio, título não encontrado, título
cancelado, título com `valor_recebido > 0`, lote inexistente/não pertencente
ao título, e remoção do último lote (um título não pode ficar sem nenhum
lote — cancelar o título é o caminho nesse caso).

UI: botão "Desvincular" (ícone `Unlink`) em cada lote da expansão de
`TitulosList.tsx`, visível só com `podeEditar`, desabilitado com tooltip
explicando o motivo do bloqueio quando aplicável. Confirmação via
`MotivoDesativacaoBox` (reuso do componente da issue 44) — motivo obrigatório
antes de habilitar "Confirmar".
