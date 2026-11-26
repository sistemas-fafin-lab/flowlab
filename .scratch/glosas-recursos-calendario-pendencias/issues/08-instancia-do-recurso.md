# 08: Instância do recurso

Spec: `.scratch/glosas-recursos-calendario-pendencias/spec.md`

**What to build:** cada requisição em recurso mostra a Instância do recurso (1º, 2º ou 3º). Ela vem do apLIS (7 → 1º, 16 → 2º), guarda a maior já vista e pode ser marcada à mão por um lápis no detalhe da requisição. A marcação manual prevalece, entra no histórico e gera um aviso quando diverge do apLIS.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Migração: instância observada na foto da requisição e campo "instância" nas edições manuais, com RLS igual ao das edições atuais.
- [ ] A sincronização grava a maior instância vista; na primeira vez, 7 → 1, 16 → 2 e o resto fica vazio.
- [ ] Função pura de instância vigente e divergência, com testes (observada só cresce, editada vence, sem instância).
- [ ] O detalhe mostra a instância; o lápis aparece só para quem gerencia o faturamento; a edição vai para o histórico com valor anterior, novo e usuário.
