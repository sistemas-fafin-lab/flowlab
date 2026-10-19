# 05: Atualizar aplica a nova emissão sozinho

**What to build:** Quando quem tem `canManageBilling` clica em **Atualizar** na aba Títulos, os títulos refechados apontados pela conferência (ticket 04) recebem a nova emissão na hora. O aviso passa a dizer "N títulos mudaram de mês por refechamento no apLIS", com operadora, lote(s), emissão antiga → nova. Meta mensal, histórico de metas, Dashboard e "Ver títulos do mês" refletem a mudança juntos, porque todos usam a emissão. Quem só visualiza continua vendo só o aviso do ticket 04, sem erro de permissão.

RPC nova que, numa transação só, atualiza `data_emissao` e, **só quando a competência era o mês da emissão antiga**, `competencia` (mesma regra da migration de 06/10). A RPC confere de novo no servidor que a nova data é posterior à atual, para ser idempotente e segura contra corrida. Exige `canManageBilling` e devolve quantos e quais títulos mudaram. Vencimento não muda. Não há correção de dados à parte: os 5 lotes de outubro entram no primeiro Atualizar depois do deploy.

Spec: `.scratch/faturamento-pendencias-e-refechamento/spec.md`.

**Blocked by:** 04 (Conferência detecta título com lote refechado)

**Status:** ready-for-agent

- [ ] O Atualizar com `canManageBilling` aplica os refechamentos e mostra quais títulos mudaram de mês.
- [ ] A competência acompanha só quando era o mês da emissão antiga. Uma competência diferente é preservada.
- [ ] A RPC recusa sem `canManageBilling` e ignora título cuja nova data não é posterior à atual (rodar duas vezes não muda nada).
- [ ] Título cancelado nunca é alterado.
- [ ] Uma falha ao ler o apLIS ou ao aplicar não apaga a lista: ela continua com os dados anteriores e mostra o erro.
- [ ] Teste da regra pura de competência. Prior art: `atualizarAplis.test.ts` e `emissaoTitulo.test.ts`.
- [ ] Conferido à mão: depois do primeiro Atualizar, a meta de out/2026 sobe cerca de R$ 51,7 mil, e o card bate com "Ver títulos do mês".
