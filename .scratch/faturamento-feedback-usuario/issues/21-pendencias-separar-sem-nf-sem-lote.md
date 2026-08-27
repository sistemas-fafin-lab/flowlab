Status: done
Type: task

# Pendências: nova lista "requisições sem lote vinculado" (lacuna real de faturamento, não só reabertura de escopo)

## Onde

`src/modules/faturamento/components/PendenciasNaoFaturadas.tsx`,
`hooks/usePendenciasNaoFaturadas.ts`, `api/_lib/faturamento/bdLab.ts:827-930`
(`listarLotesPendentes`, janela M-1 — issue 18).

## Contexto: isto reabre uma decisão da rodada 4, mas com fato novo

Na rodada 4 (spec.md, "Grilling — rodada 4") o setor já tinha pedido duas
listas separadas e a decisão registrada foi *"não criar duas listas, só trocar
a janela de M-2 para M-1"* → issue 18 (done), sob a premissa de que era uma
regra só, a nível de lote. **Investigação em 27/08 (dados reais do apLIS, via
túnel MySQL já configurado) mostra que a premissa estava incompleta**: existe
um volume real e substancial de requisições que **nunca entraram em nenhum
lote**, portanto invisíveis para `listarLotesPendentes` (que só olha
`fatlote`). Não é reabertura de preferência de UX, é uma lacuna de cobertura —
essas requisições nunca aparecem em nenhuma pendência hoje.

## Dado real (consulta direta ao MySQL do apLIS, 2026-08-27)

- **14.335 requisições** com `requisicao.Lote IS NULL` no total; **11.765**
  têm procedimento cobrável (`EXISTS` em `fatrequisicaoprocedimento`).
- Descontando `IdFontePagadora` 1102 (PARTICULAR, já coberto por
  `listarParticularesPendentes`) e 100 (Cortesia, não cobrável — mesmo
  tratamento implícito que outros pontos do módulo dão a fontes não
  faturáveis), sobram **convênios de verdade sem nenhum lote**:

  | Fonte pagadora | Qtd |
  |---|---|
  | BRADESCO SAÚDE 005711 | 577 |
  | CDI Gama | 357 |
  | CASSI | 349 |
  | ASSEFAZ | 320 |
  | Sul América | 310 |
  | Medigest | 235 |
  | GEAP | 143 |
  | AMIL | 142 |
  | AMHP-DF | 140 |
  | INAS GDF | 136 |
  | PMDF | 132 |
  | BRADESCO SAÚDE 421715 | 98 |
  | TJDFT | 76 |

- **Não é só volume represado do mês corrente** (que seria esperado — lotes
  ainda não fechados): por mês, excluindo Particular/Cortesia, o volume roda
  entre ~150 e ~600 requisições/mês, R$8mil–30mil/mês, de forma consistente
  desde pelo menos jul/2025 até hoje. Ex.: 2026-02 (590 req, R$30.938,64),
  2025-11 (299 req, R$19.128,39), 2025-07 (38 req, R$8.684,19). Query usada
  (referência, não final):

  ```sql
  SELECT DATE_FORMAT(r.DtaSolicitacao, '%Y-%m') AS mes, COUNT(*) AS qtd,
         COALESCE(SUM(frp.ValorLiquido),0) AS valor
    FROM requisicao r
    JOIN fatrequisicaoprocedimento frp ON frp.IdRequisicao = r.IdRequisicao
   WHERE r.Lote IS NULL AND r.IdFontePagadora NOT IN (1102, 100)
   GROUP BY mes ORDER BY mes DESC;
  ```

## O que fazer

1. Nova função em `bdLab.ts` (paralela a `listarLotesPendentes`), ex.
   `listarRequisicoesSemLote`: requisições com `Lote IS NULL`, com
   procedimento cobrável, excluindo `IdFontePagadora` 1102 (particulares —
   lista própria) e 100 (Cortesia — não cobrável), com a janela M-1 sobre
   `DtaSolicitacao` (reaproveitar `cutoffEAteEfetivoM1`, mesmo padrão de
   `listarParticularesPendentes`).
2. **"Sem NF (Lotes)" (lista existente, issue 07/18) perde o corte de M-1** —
   filtro só até o dia atual, por pedido explícito do setor ("nesse campo pode
   deixar o filtro até o dia atual"). Confirmar com o setor antes de tirar o
   cutoff: a issue 18 colocou M-1 ali por um motivo (mês corrente ainda no
   fluxo normal de fechamento) — perguntar se esse racional mudou ou se o
   setor só quer ver tudo e vai saber filtrar mentalmente o mês corrente.
3. Novo card/widget em Pendências para a lista nova, seguindo o padrão visual
   de `PendenciasParticulares.tsx`.
4. Considerar adicionar ao dashboard (`kpis-pendencias`) — mesma decisão da
   issue 11 pode não se aplicar automaticamente aqui, já que esta é uma lista
   nova; perguntar ao setor se quer o widget-resumo também.

## Pendente de confirmação (não bloqueia a implementação da lista em si)

- Tirar o cutoff M-1 de "Sem NF (Lotes)" é uma mudança de comportamento da
  issue 18 — vale confirmar com o setor antes de aplicar, mesmo com a query
  pronta.
- "Esses demais dados não aparecem" (screenshot de "Nenhum resultado
  encontrado") não foi confirmado como sendo esta mesma tela — segue como nota,
  não bloqueia.

## Critérios de aceite

- Nova lista mostra requisições de convênio (excluindo Particular/Cortesia)
  sem nenhum lote vinculado, dentro da janela M-1 sobre `DtaSolicitacao`.
- "Sem NF (Lotes)" e a lista nova não se sobrepõem (uma é por lote, a outra
  por ausência de lote).

## Referência

Novo relatório de feedback do setor de faturamento (27/08). Dado verificado
direto no apLIS (túnel MySQL do `.env`) em 2026-08-27.

## Comments

Implementado (27/08): item 1 (`listarRequisicoesSemLote` em `bdLab.ts`, com o
mesmo `NOT EXISTS` de RPS/NFe individual que `listarParticularesPendentes` já
tinha — evita falso positivo de requisição já cobrada fora do fluxo de lote) e
item 3 (nova sub-aba "Sem lote" em Pendências, `PendenciasSemLote.tsx`, com
filtro de fonte pagadora que já esconde Particular/Cortesia — a query sempre os
exclui). Rota `GET /api/faturamento/pendencias-sem-lote`.

Itens 2 (tirar o cutoff M-1 de "Sem NF (Lotes)") e 4 (widget-resumo no
dashboard) ficaram de fora de propósito: o próprio texto da issue marca os dois
como "pendente de confirmação com o setor" antes de aplicar, e essa confirmação
não estava disponível nesta rodada de implementação. Critérios de aceite da
lista nova (janela M-1, sem sobreposição com "Sem NF (Lotes)") foram atendidos
sem depender desses dois itens.
