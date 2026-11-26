# 05: Cards de valor no Dashboard de glosa

Spec: `.scratch/glosas-recursos-calendario-pendencias/spec.md`

**What to build:** Valor glosado (% do faturado), Valor acatado (% do glosado), Glosa recuperada (% do glosado) e Glosa em disputa (antes "Saldo pendente") substituem os cards Abertas / Em recurso / Revertidas / Definitivas. Usam a classificação de funil dos cards de glosa do Contas a Receber, pelo mês do lote original, com quantidade e variação contra o mês anterior.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Função pura dos 4 cards a partir da classificação de funil, com testes (soma bate com o funil, percentuais com faturado zero e glosado zero, variação).
- [x] O Dashboard de glosa recebe os cards e o faturado do período; a decisão sobre a origem do faturado (ver "Para revisar" no spec) fica registrada nas notas desta issue.
- [x] Visual dos cards de glosa do Contas a Receber, nos temas claro e escuro; distribuição por status e rankings continuam iguais.

## Comments

### Decisão: origem do faturado (26/11/2026)

O card do Contas a Receber soma `notas.valor_total` pela **emissão do título**. Um título pode juntar lotes de meses diferentes, então essa fonte não dá o recorte pelo mês do lote original. Por isso o "% do faturado" do Valor glosado usa o **faturado dos lotes do mês**:

- Σ `lotes.valor_total` dos lotes com `data_criacao` no mês. `data_criacao` é o `DtaCriacao` do apLIS, a mesma data que define a `competencia` da foto de recursos.
- Com o filtro de convênio, só os lotes da operadora com `operadoras.aplis_id` = fonte pagadora.
- **Limitação:** lote de faturamento sem título no FlowLab não está em `lotes` e fica fora do faturado. Nesse caso o percentual sai maior do que o real.

Implementação: `cardsValorGlosa` em `api/_lib/faturamento/glosaRecuperada.ts` (função pura, testada) e `faturadoDoMes` em `api/_lib/handlers/faturamento-glosas-recursos-dashboard.ts`. Os cards por status (`cards` do `resumirDashboard`) saíram do contrato. O `Kpi` do Contas a Receber foi extraído para `components/KpiVidro.tsx` e é usado pelas duas telas.

### Divergência com os cards do Contas a Receber (revisão, 26/11/2026)

- **Valor acatado** e **Glosa recuperada**: mesma conta nas duas telas.
  - O acatado do Contas a Receber (`notas.valor_glosa_acatada`, via `fat_glosa_acatada_nota`) é Σ líquido − recebido das requisições da foto em 18, 8 e 15. É a classe "acatada" do funil (`valorPerdaDefinitiva`).
  - Os números só diferem pelo recorte: lá é a emissão do título, aqui o mês do lote original, como o spec pede.
- **Saldo pendente**: são conceitos diferentes.
  - No Contas a Receber é Faturado − Recebido − Acatado dos títulos, isto é, o total a receber.
  - Aqui é a glosa em disputa (história 20), e Glosado = Recuperada + Acatado + Saldo pendente.

### Card "Saldo pendente" renomeado para "Glosa em disputa" (26/11/2026)

Decisão da usuária: o card mostra a glosa em disputa e não o total a receber do Contas a Receber. Por isso o nome mudou, para não confundir com o Saldo pendente de lá. A conta continua a mesma e a chave do contrato continua `saldoPendente`.
