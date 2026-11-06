# 03: Aba Comparativos (casca) e volume de envio por convênio

**What to build:** nova aba "Comparativos" no Contas a Receber, com permissão por tela (ADR 0001), seletor de mês de referência e 3 colunas (referência, M-1, M-2; padrão: último mês fechado). Entrega a infraestrutura comum dos blocos seguintes (rota de leitura com mês e filtros, resposta de indisponibilidade do apLIS) e já abre com o primeiro bloco: **volume de envio** (lotes/guias) por convênio nos 3 meses. Ver `../spec.md`.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A aba só aparece para quem tem a permissão.
- [ ] O seletor mostra referência, M-1 e M-2, com virada de ano correta.
- [ ] O volume de envio por convênio aparece nos 3 meses, em barras agrupadas e tabela.
- [ ] Falha do apLIS mostra aviso e "Tentar novamente", sem tela quebrada.
- [ ] Testes da função de períodos e de volume (dados à mão) e da rota (sem permissão, mês inválido = 400, formato da resposta); `npm test` e typecheck passam.
