# 04: Histórico com as três opções

**What to build:** o modal **Histórico** de metas mostra, para cada mês, as três candidatas (90/10, média de 2 e média de 3 meses) ao lado da meta salva e do faturado. Assim a coordenação compara os critérios ao longo do tempo. As candidatas são recalculadas ao abrir, e a meta salva não muda.

**Blocked by:** 02 (Opções no modal "Definir meta").

**Status:** ready-for-agent

- [ ] A rota de candidatas aceita um intervalo de meses e devolve as candidatas de cada mês, com uma ida só ao apLIS.
- [ ] O Histórico mostra as três colunas para todos os meses que já lista.
- [ ] Se a 03 já estiver feita, mostra também a origem de cada meta salva.
- [ ] Candidata indisponível (mês sem Elegíveis) aparece como "—".
- [ ] Com o apLIS fora do ar, o Histórico continua mostrando meta e faturado, com aviso e "Tentar novamente" nas colunas de candidatas.
- [ ] Teste da rota para o intervalo de meses (válido, inválido e invertido).
- [ ] `npm test` e o typecheck passam.
