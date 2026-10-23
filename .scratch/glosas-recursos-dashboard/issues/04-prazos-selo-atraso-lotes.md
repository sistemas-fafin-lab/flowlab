# 04: Prazos e selo de atraso na lista de lotes

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** a lista de lotes de recurso mostra a data de retorno prevista (Glosa – Análise, contada da data de envio), a data de pagamento do recurso prevista (Glosa – Pagamento, contada da data de retorno) e o selo de atraso, tudo pelas regras do convênio do lote.

**Blocked by:** 01, 03

**Status:** ready-for-agent

- [x] Cada tipo de regra calcula a data certa. Dias úteis contam de segunda a sexta, sem feriados.
- [x] Selo No prazo / Vence hoje / Atrasado em relação à data de retorno; "—" quando o convênio não tem regra.
- [x] Lotes não enviados aparecem como "Criado", sem selo e sem datas previstas.
- [x] O selo deixa de contar quando houver data real de retorno (preenchida no ticket 07) ou classificação final.
- [x] Alterar uma regra no cadastro muda os prazos exibidos na próxima consulta, sem precisar sincronizar.
- [x] A data de "hoje" entra como parâmetro nas funções de prazo.
- [x] Testes cobrem cada tipo de regra (virada de mês, fim de semana, N-ésimo dia útil, último dia do mês, sem prazo) e os quatro estados do selo.

## Comments

**Implementado (23/10/2026).** Decisões tomadas na implementação, para revisar:

- **Módulo puro:** `aplicarRegraPrazo(regra, base)` e `prazosDoLote(lote, regras, hoje)` em `api/_lib/faturamento/recursoGlosa.ts`. Datas são 'YYYY-MM-DD' contadas em calendário (UTC, sem fuso); o handler passa o "hoje" de America/Sao_Paulo.
- **Dias úteis:** a contagem começa no dia seguinte à data base (base num sábado + 1 dia útil = segunda).
- **Mês curto:** "dia X do mês seguinte" que o mês não tem cai no último dia dele (dia 31 em fevereiro = 28/29). "N-ésimo dia útil" além dos dias úteis do mês cai no último dia útil.
- **Classificação final do lote:** todas as requisições do lote (em qualquer mês de faturamento) já têm resultado, ou seja, nenhuma está em análise. **Deferido parcial conta como final** (a operadora respondeu). O spec chama esse estado de "em tratativa"; se o selo deve continuar contando nele, conferir com a responsável.
- **Regra do lote:** a da fonte pagadora do lote e, se ela não estiver ligada, a primeira fonte das requisições do lote que estiver ligada (os dois cadastros do Bradesco podem divergir entre lote e requisição).
- **"—":** sem regra ligada ou com Glosa – Análise "sem prazo". Nesse caso a data de pagamento prevista também fica vazia, porque não tem base, até haver data real de retorno (ticket 07).
- **Data real de retorno:** `prazosDoLote` já a recebe; o handler passa `null` até o ticket 07.
- **Lote cancelado:** o spec não trata esse caso. Um lote "Cancelado" com data de envio ainda recebe selo.
- **Tela:** colunas "Retorno previsto", "Pagamento previsto" e "Atraso" na lista de lotes.

