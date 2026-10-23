# 08: Rotina diária de sincronização

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** uma rotina agendada (cron da Vercel, como as que já existem no projeto) que sincroniza todos os meses de faturamento de 2026 uma vez por dia. A tela mostra quando foi a última sincronização e até que data vai o dado do apLIS.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] O cron está registrado e protegido como os outros crons do projeto.
- [ ] A rotina sincroniza mês a mês e não estoura o tempo máximo da função; se precisar, ajusta o `maxDuration` ou divide em partes.
- [ ] Uma falha num mês não impede os outros e é registrada no log.
- [ ] O cabeçalho da página mostra a data e hora da última sincronização e a data do dado do apLIS.
