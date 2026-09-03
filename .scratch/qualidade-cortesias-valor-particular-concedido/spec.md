# Cortesias: divergência no cálculo de Valor Particular/Concedido vs. projeto de origem

Status: needs-info

## Contexto

Comparando este repo com o projeto de origem do módulo Qualidade
(`Flowlab_Controle_Qualidade`, branch `main`, commit `ad2efd4` — ":bug: fix:
cortesias — valor particular/concedido e data do MySQL"), o cálculo de
Valor Particular e Valor Concedido de uma cortesia diverge entre os dois
repos. Não está claro qual dos dois está correto — pode ser um bug aqui, uma
regra de negócio diferente adotada deliberadamente aqui, ou um bug lá que já
foi corrigido e este repo nunca recebeu o fix. Por isso vira uma issue de
investigação (`needs-info`), não um port automático.

## O que o projeto de origem faz hoje (depois do fix)

Em `api/_lib/qualidade/bdLabCortesias.ts`:

- **Valor Particular** = soma direta de `fatrequisicaoprocedimento.ValorUnitario`
  por `IdRequisicao` (antes do fix somava `ValorCobrado`, "por engano",
  segundo a mensagem do commit).
- **Valor Concedido** = sempre igual ao Valor Particular — "uma cortesia é,
  por definição, a isenção integral do valor particular, nunca um desconto
  parcial".
- Comentário no arquivo justifica: "a tabela de preço do convênio de
  cortesia nunca foi mantida no LIS, então o valor de tabela do procedimento
  é a única fonte confiável".

## O que este repo faz hoje

Em `api/_lib/qualidade/bdLabQualidade.ts`
(`listarAutorizacoesCortesiaLis`):

```sql
SUM(fp.ValorBruto) AS ValorBruto, SUM(fp.ValorCobrado) AS ValorCobrado, SUM(fp.ValorDesconto) AS ValorDesconto
```

- `valorParticular` ← `ValorBruto`
- `valorCobrado` ← `ValorCobrado`
- `valorConcedido` ← `ValorDesconto`

Ou seja: aqui, Valor Concedido é o desconto real registrado
(`ValorDesconto`), podendo ser um valor **parcial**, diferente do Valor
Particular. Lá, Valor Concedido é forçado a ser sempre igual ao Valor
Particular (desconto integral).

Nota à parte: o fix de origem também adiciona `dateStrings: true` na conexão
MySQL para evitar que colunas `DATE` virem `Date` do JS e quebrem o insert no
Postgres. Este repo **não tem esse bug** — já formata a data explicitamente
via `DATE_FORMAT(ra.DtaCriacao, '%Y-%m-%d')` na própria query SQL, então não
precisa da flag de conexão. Não é necessário portar essa parte.

## O que fazer

1. `01-investigar-calculo-valor-particular-concedido.md` — validar com quem
   tem contexto de negócio (Qualidade/Faturamento) qual das duas regras está
   correta, usando exemplos reais do LIS (a mensagem do commit de origem cita
   `CodRequisicao 0040002289003 / 0200012764000` como exemplo confirmado
   pelo usuário deles — vale conferir esse mesmo `CodRequisicao` neste
   ambiente, se existir).
