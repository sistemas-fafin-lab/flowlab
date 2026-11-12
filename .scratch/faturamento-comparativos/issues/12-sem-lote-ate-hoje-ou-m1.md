# 12: "Requisições não faturadas" conta até hoje ou até M-1?

**What to decide:** a regra de data do card "Requisições não faturadas" (Dashboard) e da sub-aba Pendências → "Sem lote". O código e o spec dizem coisas diferentes, e só a gestora do Faturamento pode dizer qual vale.

**Blocked by:** None.

**Status:** ready-for-human (decisão da gestora; a mudança no código é pequena)

## O conflito

- **Spec** (`../spec.md`, Implementation Decisions): "Requisição não faturada = requisição de convênio cobrável, sem lote e sem RPS ativo, **até M-1**". A issue 01 repete "sem lote, até M-1".
- **Código** (`api/_lib/faturamento/bdLab.ts`, `listarRequisicoesSemLote`): usa `limiteEAteEfetivoHoje`, então a lista vai **até hoje**. O card do Dashboard usa a mesma rota (issue 01), então também vai até hoje.
- **Histórico**: a issue 21 de `.scratch/faturamento-feedback-usuario/` planejava M-1 para esta lista (`cutoffEAteEfetivoM1`). Na mesma rodada, o setor pediu para outra lista "deixar o filtro até o dia atual", e a implementação ficou com "até hoje". Não está registrado se essa escolha valia também para "Sem lote".

## Por que importa

- Com **até hoje**, o mês corrente entra no número. Em 12/11/2026, 11/2026 tinha 789 requisições / R$ 253.321,38 sem lote, em boa parte ainda no fluxo normal de fechamento. Isso não é atraso.
- Com **até M-1**, o card mostra só o que já passou da janela de fechamento. É o mesmo racional de "Lotes sem nota fiscal" (issue 18 do feedback), e os cards ficam comparáveis.
- O seletor de mês do Dashboard recorta a data de solicitação. Com um mês passado escolhido, as duas regras dão o mesmo número. A diferença aparece em "Todos os meses" e no mês corrente.

## Pergunta para a gestora

1. "Requisições não faturadas" deve contar o mês corrente (até hoje) ou só até o fim do mês anterior (M-1)?
2. Se for M-1: a sub-aba "Sem lote" muda junto (as duas precisam bater) ou só o card?

## Se a resposta for M-1

- Em `listarRequisicoesSemLote`, trocar `limiteEAteEfetivoHoje` por `cutoffEAteEfetivoM1` e ajustar o comentário da função e o cabeçalho da rota `faturamento-pendencias-sem-lote.ts` ("solicitadas até hoje").
- Os filtros padrão da sub-aba (`PendenciasSemLote.tsx`: início do mês corrente até hoje) passariam a dar lista vazia. Mudar o padrão para o mês anterior.
- Atualizar o teste de rota `faturamento-pendencias-sem-lote.test.ts` se ele fixar o campo `limite` do meta.

## Se a resposta for "até hoje"

- Corrigir o spec e a issue 01 para "até hoje" e fechar esta issue.
