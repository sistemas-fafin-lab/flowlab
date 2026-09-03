Status: done
Type: fix

# Fix: Valor Concedido de Cortesias deve ser igual ao Valor Particular

Refs: `01-investigar-calculo-valor-particular-concedido.md` (investigação e
evidência que motivam este fix).

## Onde

- `api/_lib/qualidade/bdLabQualidade.ts` (`listarAutorizacoesCortesiaLis`,
  ~linha 210-257).

## O que fazer

A investigação em `01-investigar-calculo-valor-particular-concedido.md`
confirmou, contra o MySQL de backup real (295.806 linhas de
`fatrequisicaoprocedimento`, amostra de 25 cortesias `Tipo=3 AND
Autorizado=1`):

- `fatrequisicaoprocedimento.ValorDesconto` nunca é preenchido neste banco
  (0 linhas não-nulas/≠0 em toda a tabela) — o cálculo atual de
  `valorConcedido` (`SUM(fp.ValorDesconto)`) sempre resulta em `NULL`/0 para
  toda cortesia real, mesmo quando a isenção foi integral.
- Uma cortesia autorizada sempre tem `ValorCobrado` `NULL` (nada é cobrado
  do paciente) — ou seja, na prática toda cortesia concedida neste LIS é
  isenção integral, nunca desconto parcial.

Ajustar `valorConcedido` para ser sempre igual a `valorParticular`
(`ValorBruto`), em vez de `SUM(fp.ValorDesconto)`. Não é necessário somar
`fp.ValorDesconto` na query — pode ser removido, já que nada mais o usa.

**Não alterar** o cálculo de Valor Particular (`SUM(fp.ValorBruto)`) — a
investigação confirmou que está correto (contempla `Quantidade` do
procedimento corretamente, diferente da abordagem do projeto de origem, que
teria uma regressão nesse ponto).

Atualizar também o comentário da interface `AutorizacaoCortesiaLis` (linha
~204) que hoje descreve `valorConcedido` como vindo de `ValorDesconto`.

## Critérios de aceite

- `valorConcedido` retornado por `listarAutorizacoesCortesiaLis` é sempre
  igual a `valorParticular` para toda cortesia da listagem.
- Nenhuma referência residual a `ValorDesconto`/`SUM(fp.ValorDesconto)` no
  arquivo.
- Typecheck e suíte de testes do módulo Qualidade passam.

## Comments

### 2026-09-03 — Implementado na mesma sessão da investigação

Implementado direto (issue pequena, totalmente especificada pela
investigação da 01). `valorConcedido` agora é sempre `numero(linha.ValorBruto)`
(igual a `valorParticular`); `SUM(fp.ValorDesconto)` removido da query.
Comentário da interface `AutorizacaoCortesiaLis.valorConcedido` atualizado.

Validado contra o MySQL de backup real (mesma conexão da investigação):
`listarAutorizacoesCortesiaLis('2026-08-01', '2026-08-31')` — 50 cortesias no
período, todas agora com `valorConcedido === valorParticular` (antes, todas
saíam com `valorConcedido: null`, disparando falso positivo em R3
`calcularDivergenciaValores` e R4 `calcularPrecoCortesiaNaoCadastrado` de
`cortesiasRegras.ts` para toda cortesia real).

`npx tsc --noEmit -p api/tsconfig.json` sem erros novos (erros pré-existentes
em `aol.test.ts`/`apoio-transferir.test.ts`, não relacionados). Suíte
completa (`npx vitest run`): 340/340 testes passando. `/code-review` rodado
sobre o diff da sessão — nenhum achado no arquivo alterado por esta issue.
