# 07 — Ajuste de ocorrência ("só este mês" ou "deste mês em diante")

**What to build:** no Mês a mês, o usuário clica em "Ajustar" numa ocorrência e muda
valor, vencimento, forma de pagamento ou observação. Ao salvar, escolhe **"só em
out/2026"** (grava um lançamento com status `previsto`) ou **"de out/2026 em diante"**
(cria um reajuste na despesa). A linha ajustada mostra o original riscado ao lado. É
assim que a TI atualiza a estimativa de cloud, telefonia ou uso de IA ao longo do mês.
Desfazer um ajuste sem baixa volta a ocorrência à previsão calculada.

Também cobre a RN17: mudar a recorrência de uma despesa nunca apaga lançamentos, e os
que caírem numa competência sem ocorrência aparecem com o selo "fora da recorrência".

Plano: §7 (Mês a mês), RF11, RN04 (item 1), RN15, RN17, D6.

**Blocked by:** 06

**Status:** done (sem migration nova; tela não conferida no navegador)

- [x] `domain/situacao.ts`: a prioridade da RN04 (ajuste > reajuste > valor base) para valor, vencimento e forma de pagamento já é aplicada em `montarOcorrenciasDoMes` (feito junto com a 06).
- [x] Testes: ajuste só neste mês não muda as outras competências; vencimento ajustado para depois de hoje tira de "vencida"; desfazer ajuste volta ao calculado; reajuste posterior não sobrescreve o ajuste da competência.
- [x] `AjusteOcorrenciaModal` com a pergunta "só este mês / deste mês em diante".
- [x] Selo "ajustada" e original riscado ao lado do previsto ajustado.
- [x] Selo "fora da recorrência" + ação de manter (não fazer nada) ou excluir; teste de mudança de recorrência com lançamentos existentes (em `situacao.test.ts`).
- [x] `npx tsc --noEmit`, `npm run lint` e `npm test` sem erros novos.

## Comments

**01/Out/2026 — implementado.**

**Decisão de desenho:** "deste mês em diante" vira reajuste da despesa e por isso **só muda o valor**. A despesa não guarda histórico datado de vencimento nem de forma de pagamento, então mudar esses dois "em diante" seria reescrever todos os meses. O modal diz isso e manda editar a despesa para mudar de vez. Se o mês já tinha um ajuste ainda não pago, o valor dele acompanha o reajuste; sem isso, o ajuste antigo continuaria mandando no mês (RN04 item 1).

**Regras puras, `domain/ajuste.ts` (14 testes):**
- `validarAjuste`:
  - "só este mês" aceita valor zero e recusa salvar sem mudança;
  - "em diante" reaproveita `validarReajuste`, que recusa o mês inicial com a mensagem que manda editar a despesa, e recusa valor igual ao vigente.
- `linhaAjusteNovo`: o primeiro toque cria o lançamento como `previsto`.
- `camposAjuste`: não mexe no status, então um ajuste depois da baixa não "despaga" a cobrança.

**Hook:** `useLancamentosTI.ajustar` faz insert no primeiro toque e update depois. Um 23505 vira "alterado por outra pessoa, recarregue".

**Tela:**
- "Ajustar" nas cobranças não pagas.
- "Desfazer ajuste" quando a ocorrência só tem ajuste: apaga a linha e volta ao calculado.
- Desfazer a baixa de uma ocorrência ajustada volta para "previsto" mantendo o ajuste, pelo `acaoAoDesfazer` da 06.
- Lançamento fora da recorrência mostra o selo e "Excluir" no lugar de "Desfazer"; manter é não fazer nada.

**Verificação:**
- `tsc`: nenhum erro em `gastos-ti`.
- `eslint` limpo.
- 148 testes do módulo passando.
