# Faturamento: aplicar as baixas do apLIS nos títulos

Status: ready-for-agent

## Problem Statement

O setor registra o recebimento no apLIS (tela de Baixa) e precisa lançar a
mesma baixa de novo no Contas a Receber, título a título. A conferência
(`.scratch/faturamento-conferencia-baixas-aplis`) já aponta o que falta, mas o
operador ainda digita tudo duas vezes.

## Solution

Botão **"Aplicar baixas do apLIS"** no cabeçalho do Contas a Receber. Ele abre
uma **prévia** com as baixas que faltam lançar (calculadas a partir da
conferência), o operador desmarca o que não quiser e confirma; o sistema
lança cada baixa pela mesma RPC do "Registrar baixa" (`fat_registrar_baixa`).

Revê a decisão "a conferência nunca lança nada" da spec da conferência: ela
continua sem lançar sozinha — quem lança é o operador, ao confirmar a prévia.

## Decisões (14/10/2026)

1. **Gatilho:** botão com prévia e confirmação (sem cron).
2. **Só a baixa:** lança o valor recebido no apLIS. Glosa continua manual (motivo
   e código vêm do demonstrativo do convênio); o saldo fica em aberto até lá.
3. **Título sem número da nota:** fica fora (a regra da issue 34 continua) e
   aparece na prévia como "pulado — sem número da nota".
4. **Uma baixa por data de recebimento no apLIS** — no sistema cada baixa é um
   depósito com data própria, e o apLIS registra o pagamento principal e os
   complementos (recurso) em datas diferentes. Levantamento de 14/10 (lotes
   com recebimento desde 2025): 1.788 com 1 data, ~500 com 2 ou mais.
5. **Tipos:** só `so-no-aplis` e `aplis-maior`. `sistema-maior` e `lote-ausente`
   nunca geram baixa (exigiriam excluir ou adivinhar).
6. **Dado do apLIS até ontem** (réplica): a prévia mostra o aviso.

## Regra das baixas sugeridas (por título)

Entrada: recebido no apLIS por data (soma de `ValorRecebido > 0` dos lotes do
título, agrupado por `DATE(DtaRecebido)`), baixas já registradas no sistema
(valor e data) e `diferença = recebidoAplis − recebidoSistema` (≥ R$ 1,00).

- Sistema sem baixa (`so-no-aplis`): uma baixa por data do apLIS, com o valor
  daquela data.
- Sistema com baixa (`aplis-maior`): descarta as datas do apLIS que já têm
  baixa no sistema na mesma data. Se a soma das datas restantes bate com a
  diferença (tolerância R$ 1,00), uma baixa por data restante; senão, **uma
  baixa só, com a diferença, na data do último recebimento no apLIS** (o
  operador lançou em outras datas e não dá para casar uma a uma).
- Datas com valor < R$ 0,01 ficam fora.
- Observação de cada baixa: `Baixa do apLIS — lote(s) 6329 (recebido em
  22/09/2026)`. Banco, conta e forma ficam vazios.

## Implementation Decisions

- **Backend:** nova action `titulos-baixas-aplis-previa` (GET, `canManageBilling`)
  no dispatcher de faturamento. Reaproveita a leitura da conferência
  (títulos e lotes via cliente do usuário, MySQL em blocos de 1.000) e
  acrescenta o recebido do apLIS por data e as baixas do sistema. Devolve
  `{ titulos: [{ idNota, numeroNota, operadora, tipo, recebidoSistema,
  recebidoAplis, baixas: [{ data, valor, observacoes }], pulado: 'sem-nota' |
  null }], meta.dadoAte }`. Sem escrita. Falha da réplica → 502.
- **Utilitário puro** com a regra acima, testado em vitest.
- **Frontend:** botão ao lado de "Conferir baixas com o apLIS", só com
  `canManageBilling`; modal de prévia no padrão do `AtualizarAplisModal`
  (marcar/desmarcar por título, total a lançar, pulados à parte). Confirmar
  chama `fat_registrar_baixa` uma baixa por vez (sem glosas), mostra o
  progresso e o resultado por título (lançado / erro com a mensagem). Ao
  fechar, refaz a lista e a conferência.
- Sem migration: a RPC atual já aceita banco/conta/forma vazios e grava
  `registrado_por` = quem confirmou.

## Testing Decisions

- Utilitário: so-no-aplis com 1 e 3 datas; aplis-maior com datas novas que
  batem; aplis-maior que não bate (baixa única com a diferença); data já
  lançada no sistema; tolerância de R$ 1,00.
- Handler: 401/403 (precisa `canManageBilling`), título sem número pulado,
  `sistema-maior`/`lote-ausente` fora, 502 na falha da réplica.

## Out of Scope

- Lançar sozinho (cron).
- Glosa automática.
- Corrigir `sistema-maior` (excluir baixa) automaticamente.
- Escrever qualquer coisa no apLIS.
