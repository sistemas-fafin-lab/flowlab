# 06: SLA por convênio e tempo médio de liquidação

**What to build:** na aba Comparativos, o tempo médio (dias) por convênio de: cadastro → envio ao faturamento (primeira tarefa tipo 34); envio → recebido no faturamento (primeira tarefa 37 ou 44); recebido → faturado (fechamento do lote, fallback criação). Cadastro = evento "Admissão" do histórico, fallback data de solicitação. Mais o **tempo médio de liquidação** (faturado → recebido), só de requisições já recebidas, com "% já recebido". Cada marco indica a fonte (apLIS hoje). Intervalos negativos são descartados e contados à parte. Ver `../spec.md`.

**Blocked by:** 03

**Status:** needs-info

Pergunta aberta para a usuária: a tarefa 34 é mesmo o envio ao faturamento? Implementar com a 34 e trocar só esse marco se a resposta for outra.

- [ ] Média por convênio e total, para os 3 meses.
- [ ] Fallbacks, intervalo negativo e convênio sem dados cobertos por testes de função pura.
- [ ] Liquidação mostra o "% já recebido".
- [ ] `npm test` e typecheck passam.
