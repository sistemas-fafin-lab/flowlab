# 06 — Mês a mês: baixa, dispensa, editar e desfazer

**What to build:** a aba Mês a mês mostra, para uma competência escolhida, todas as
ocorrências previstas com a situação (a vencer, vencida, paga, dispensada) e os totais
de previsto, pago, em aberto e vencido. O usuário dá baixa (valor, data, forma de
pagamento, NF, comprovante), dá baixa em lote nas fixas, dispensa uma ocorrência que
não foi cobrada, edita uma baixa já feita e desfaz baixa ou dispensa. Qualquer mês,
passado ou futuro, pode ser aberto e editado. A linha só é gravada no primeiro toque.

Plano: §4.1 (`ti_lancamentos`), §7 (Mês a mês), RF10, RF12, RF13, RN03, RN07, RN15,
RN16.

**Blocked by:** 04

**Status:** done (migration gerada, ainda não aplicada; tela não conferida no navegador)

- [x] Migration: `ti_lancamentos` completa como na §4.1, já com o status `previsto` (usado na 07), CHECKs por status, UNIQUE `despesa_id` + `competencia`, `RESTRICT` para `ti_despesas`, RLS (DELETE com manage) e auditoria.
- [x] `domain/situacao.ts` (+ teste): cruza ocorrências calculadas com lançamentos e classifica com `hoje` como argumento.
- [x] `useLancamentosTI` filtrando por competência no servidor.
- [x] `MesAMesPage`: seletor ‹ competência ›, quatro totais, lista agrupada com vencidas no topo.
- [x] `BaixaModal` e `BaixaLoteModal`; comprovante usa o bucket da 05.
- [x] Dispensar com motivo obrigatório; editar baixa; desfazer apaga o lançamento, ou volta para "previsto" quando a ocorrência tinha ajuste (`acaoAoDesfazer`).
- [x] Selo "estimado" em despesa variável ainda sem baixa.
- [x] Teste: mesma entrada com `hoje` diferente muda só a situação, não a projeção.
- [x] `npx tsc --noEmit`, `npm run lint` e `npm test` sem erros novos.

## Comments

**01/Out/2026 — implementado.**

**Migration:** `supabase/migrations/20261009160000_gastos_ti_lancamentos.sql`.
- CHECKs de coerência:
  - status `pago` se e só se há `valor_pago` e `pago_em`;
  - status `dispensado` se e só se há motivo.
- Trigger `ti_lancamentos_validar`:
  - na criação, a competência precisa ser cobrança da despesa, com a mesma conta de `recorrencia.ts` (início, fim e ciclo). Ninguém grava pagamento num mês que não existe, nem pela API;
  - depois de criado, despesa e competência ficam imutáveis;
  - também cuida dos carimbos.
- `RESTRICT` para `ti_despesas` e auditoria com `despesa_id`, o que já faz o histórico da despesa mostrar os lançamentos.

**Teste da migration (PGlite):** 34 de 34 verificações passaram.
- O teste revelou que apagar despesa com lançamento devolve **23001** (`restrict_violation`, Postgres recente) e não 23503. O banco recusava do mesmo jeito, mas a tela não traduzia a mensagem.
- Corrigido em `useDespesasTI.excluirDespesa`, que agora trata os dois códigos.

**Regras puras, 23 testes novos (134 no módulo):**
- `situacao.ts`:
  - `montarOcorrenciasDoMes` aplica o lançamento sobre valor, vencimento e forma (RN04 item 1);
  - calcula a situação e os selos "ajustada", "estimado" e "fora da recorrência" (RN17);
  - ordena vencidas → a vencer → pagas → dispensadas.
  - `totaisDoMes` não conta dispensadas no previsto.
- `baixa.ts`:
  - validação, com data futura recusada e valor zero aceito;
  - linhas de upsert. A baixa em lote omite NF e observação para não sobrescrever o que um ajuste já tinha;
  - `acaoAoDesfazer`.

**Refactor:** `anexosRegistro.ts` reúne os anexos de despesa e de lançamento, e `useDespesasTI` passou a usá-lo.

**Hook `useLancamentosTI(competencia)`:**
- baixa e dispensa por upsert em `(despesa_id, competencia)`, o que cria a linha no primeiro toque (RN15);
- baixa em lote numa instrução só;
- desfazer apaga também os comprovantes quando a linha some.

**Tela `MesAMesPage`:**
- campo de mês com ‹ › e "Mês atual";
- 4 totais e chips de situação com contagem, mais busca;
- seleção com "Dar baixa em lote", que avisa quando há variáveis entrando pela estimativa;
- original riscado ao lado do valor ou vencimento ajustado;
- situação sempre com ícone e rótulo;
- desfazer pede confirmação em dois cliques;
- trocar de mês esmaece a tabela em vez de piscar.

Modais: `BaixaModal` (também para editar, com os comprovantes), `DispensaModal` e `BaixaLoteModal`.

**Verificação:**
- `tsc`: nenhum erro em `gastos-ti`.
- `eslint` limpo.
- 134 testes do módulo passando.

**A aplicar:** `20261009160000_gastos_ti_lancamentos.sql`.
