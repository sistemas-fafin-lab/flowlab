# Pendências: requisições não faturadas (janela M-2)

Documento de levantamento a partir de `.scratch/faturamento-feedback-usuario/issues/07-pendencias-requisicoes-nao-faturadas.md`.
Implementado nesta entrega — este arquivo registra o achado pedido no ticket
sobre os lotes "Recebidos sem RPS", que a regra decidida no grilling deixa de
fora da aba Pendências.

**Status**: implementado.

---

## 1. A regra

Lote pendente = `fatlote.IdRPS IS NULL`, `Status IN (1, 2, 3, 6, 7)` (exclui
5 Cancelado e 8 Prejuízo), `DtaCriacao` até o fim do mês retrasado (M-2) — os
dois meses mais recentes ainda estão no fluxo normal de fechamento.

Contagem de apoio (confirmada no MySQL de backup em 18/08/2026, lotes sem
`IdRPS` por status, excluindo 5 e 8):

| Status | Label               | Sem IdRPS |
| ------ | -------------------- | ---------: |
| 1      | Em Processamento     |        156 |
| 2      | Conciliação          |         41 |
| 3      | Faturado              |        813 |
| 4      | Recebido              |      3.188 |
| 6      | Exportado TOTVS       |          4 |
| 7      | Recebido - parcial    |        873 |

Os números batem exatamente com o levantamento original do ticket. Com o
corte de M-2 aplicado (hoje = 18/08/2026 → cutoff = 30/06/2026), o conjunto
de pendência real (status 1, 2, 3, 6, 7) cai para **1.604 lotes**.

## 2. Por que "Recebidos sem RPS" (status 4, 3.188 lotes) fica fora da regra

Hipótese do ticket: são NFs lançadas fora do apLIS. Confirmado por dois
levantamentos:

**a) Distribuição no tempo não é um blip de migração.** Lotes Recebidos sem
`IdRPS` aparecem de forma constante desde dez/2020 até hoje (dezenas por mês,
o histórico inteiro). Se fossem só dado de migração inicial, estariam
concentrados nos primeiros meses do backup.

**b) Lotes Recebidos COM `IdRPS`, ao contrário, só existem a partir de
out/2025** — praticamente todos nos últimos ~9 meses. Ou seja: o vínculo
`fatlote.IdRPS` só passou a ser preenchido de forma consistente recentemente;
antes disso a nota fiscal era emitida por fora (contabilidade/sistema
próprio) e nunca religada ao lote no apLIS.

**c) O vínculo por requisição (`fatrpsrequisicao` → `fatrps`) também não
explica o grosso do conjunto**: só 36 dos 3.188 lotes Recebidos-sem-IdRPS têm
qualquer requisição ligada a um RPS individual (34 com `NFeNumero`
preenchido). Não é um problema de granularidade (RPS por requisição em vez de
por lote) — é ausência real de registro no apLIS.

**Conclusão**: o pagamento desses 3.188 lotes já aconteceu (`Status = 4`
Recebido) mesmo sem o vínculo de NF no apLIS. Não é uma pendência de
cobrança — é uma lacuna de dado histórico, fora de escopo desta entrega.
Por isso a regra da aba Pendências não inclui `Status = 4`, mesmo sem
`IdRPS`.

## 3. Verificação fina por requisição (implementada como sinal, não como filtro)

O ticket cita colunas de um export do apLIS (`NFeReq`, `RPSReq` em
`csv-filter`/`filtros.md`) para "refinar a lista" por requisição. Essas
colunas não existem como tal no MySQL de backup — o equivalente real é o
join `requisicao → fatrpsrequisicao → fatrps`, que liga um RPS/NFe a uma
requisição específica, independente do `fatlote.IdRPS` do lote inteiro.

Medido no conjunto de pendência real (1.604 lotes, status 1/2/3/6/7 até
30/06/2026): **apenas 25 lotes (~1,6%)** têm alguma requisição com esse
vínculo individual. Por ser tão raro e não invalidar a pendência do lote como
um todo (o lote continua sem NF fechada), a implementação expõe isso como um
sinal informativo por requisição (`RequisicaoPendencia.nfeNumero`/
`numeroRPS`, badge verde na expansão da linha) em vez de filtrar o lote da
lista — o operador vê e decide, em vez de a regra decidir por ele.

## 4. Implementação

- `api/_lib/faturamento/bdLab.ts`: `listarLotesPendentes` (lista, cutoff
  calculado no MySQL via `CURDATE()` para não sofrer o desvio de fuso
  Vercel-UTC vs. dev America/Sao_Paulo) e `detalharLotePendencia`
  (requisições + sinal de NF individual), cache de 3 min como o resto do
  arquivo.
- `api/_lib/handlers/faturamento-pendencias.ts` e
  `faturamento-pendencia-detalhe.ts`, registrados em
  `api/faturamento/[action].ts` como `pendencias-nao-faturadas` e
  `pendencia-lote-detalhe`.
- `src/modules/faturamento/hooks/usePendenciasNaoFaturadas.ts` +
  `components/PendenciasNaoFaturadas.tsx`, nova aba "Pendências" em
  `ContasReceberPage.tsx` (filtros de período e fonte pagadora, lista
  expansível até a requisição).
