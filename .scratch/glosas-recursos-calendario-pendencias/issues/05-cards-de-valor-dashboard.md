# 05: Cards de valor no Dashboard de glosa

Spec: `.scratch/glosas-recursos-calendario-pendencias/spec.md`

**What to build:** Valor glosado (% do faturado), Valor acatado (% do glosado), Glosa recuperada (% do glosado) e Saldo pendente (glosa em disputa) substituem os cards Abertas / Em recurso / Revertidas / Definitivas. Usam a classificação de funil dos cards de glosa do Contas a Receber, pelo mês do lote original, com quantidade e variação contra o mês anterior.

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

Os quatro cards seguem a tabela do spec: Acatado = classe "acatada" e Saldo pendente = "em disputa", ambos do funil. No Contas a Receber, porém:
- o Acatado vem de `notas.valor_glosa_acatada`;
- o Saldo pendente é Faturado − Recebido − Acatado dos títulos;
- a Recuperada é cortada pela data da glosa no funil (emissão do título).

Então só a classificação é a mesma. Os valores de um mesmo mês podem diferir entre as duas telas. Para revisar com a gestora se isso incomodar.
