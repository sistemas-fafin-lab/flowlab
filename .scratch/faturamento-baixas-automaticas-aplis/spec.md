# Faturamento: aplicar as baixas do apLIS nos títulos

Status: done

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

### Decisões da implementação (14/10/2026)

7. **Título com número e sem data de recebimento no apLIS** (valor recebido,
   mas sem `DtaRecebido`): a rota devolve `baixas: []` e a prévia mostra
   "pulado — sem data de recebimento no apLIS".
8. **Lote vinculado a dois títulos:** os dois sugerem a mesma baixa (data,
   valor e observação). Lançar nos dois contaria o recebimento em dobro. Por
   isso esses títulos vêm **desmarcados** com o selo "lote em outro título", e
   o operador escolhe em qual lançar.
9. **Falha no meio de um título:** as baixas seguintes do mesmo título não são
   tentadas (cada uma depende do saldo que a RPC recalcula). O título fica como
   "lançadas N de M, depois falhou" e os demais títulos seguem.
10. **Em sequência, sem paralelismo:** uma baixa por vez, também entre títulos.
    Cada RPC é rápida; paralelizar entre títulos só vale se a fila ficar lenta.
11. **Fechar no meio:** pede confirmação e para de iniciar baixas novas (o que
    já foi lançado fica). A lista e a conferência são relidas ao fechar e, se
    uma baixa ainda estava no ar, de novo quando ela termina.

## Regra das baixas sugeridas (por título)

Entrada: recebido no apLIS por data (soma de `ValorRecebido > 0` dos lotes do
título, agrupado por `DATE(DtaRecebido)`), baixas já registradas no sistema
(valor e data) e `diferença = recebidoAplis − recebidoSistema` (≥ R$ 1,00).

- Sistema sem baixa (`so-no-aplis`): uma baixa por data do apLIS, com o valor
  daquela data. Se as datas não somam o recebido (estorno negativo ou
  recebimento sem data no apLIS), cai na baixa única com a diferença, como o
  `aplis-maior` — senão lançaria mais do que o recebido.
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
  progresso e o resultado por título (lançado / lançado em parte / erro com
  a mensagem). Ao fechar, refaz a lista e a conferência. O payload da RPC é
  montado por `rpcRegistrarBaixa` (`useContasReceber`), compartilhado com o
  "Registrar baixa"; o modal não usa o `registrarBaixa` do hook porque ele
  relê a lista a cada baixa.
- Sem migration: a RPC atual já aceita banco/conta/forma vazios e grava
  `registrado_por` = quem confirmou.

## Testing Decisions

- Utilitário: so-no-aplis com 1 e 3 datas; aplis-maior com datas novas que
  batem; aplis-maior que não bate (baixa única com a diferença); data já
  lançada no sistema; tolerância de R$ 1,00.
- Handler: 401/403 (precisa `canManageBilling`), título sem número pulado,
  `sistema-maior`/`lote-ausente` fora, 502 na falha da réplica.
- Utilitário do frontend (`utils/aplicarBaixasAplis.ts`): separação de
  aplicáveis e pulados (com o motivo), títulos com baixa repetida e seleção
  inicial, total marcado em centavos, resumo da execução.

## Implementado

- Issue 01 — rota da prévia: `api/_lib/handlers/faturamento-titulos-baixas-aplis-previa.ts`,
  regra em `api/_lib/faturamento/baixasAplis.ts`.
- Issue 02 — botão e modal: `src/modules/faturamento/components/AplicarBaixasAplisModal.tsx`.
- Testado no navegador em 14/10/2026.

## Out of Scope

- Lançar sozinho (cron).
- Glosa automática.
- Corrigir `sistema-maior` (excluir baixa) automaticamente.
- Escrever qualquer coisa no apLIS.
