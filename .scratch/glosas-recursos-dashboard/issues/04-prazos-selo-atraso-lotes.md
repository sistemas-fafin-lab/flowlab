# 04: Prazos e selo de atraso na lista de lotes

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** a lista de lotes de recurso mostra a data de retorno prevista (Glosa – Análise, contada da data de envio), a data de pagamento do recurso prevista (Glosa – Pagamento, contada da data de retorno) e o selo de atraso, tudo pelas regras do convênio do lote.

**Blocked by:** 01, 03

**Status:** ready-for-agent

- [ ] Cada tipo de regra calcula a data certa. Dias úteis contam de segunda a sexta, sem feriados.
- [ ] Selo No prazo / Vence hoje / Atrasado em relação à data de retorno; "—" quando o convênio não tem regra.
- [ ] Lotes não enviados aparecem como "Criado", sem selo e sem datas previstas.
- [ ] O selo deixa de contar quando houver data real de retorno (preenchida no ticket 07) ou classificação final.
- [ ] Alterar uma regra no cadastro muda os prazos exibidos na próxima consulta, sem precisar sincronizar.
- [ ] A data de "hoje" entra como parâmetro nas funções de prazo.
- [ ] Testes cobrem cada tipo de regra (virada de mês, fim de semana, N-ésimo dia útil, último dia do mês, sem prazo) e os quatro estados do selo.
