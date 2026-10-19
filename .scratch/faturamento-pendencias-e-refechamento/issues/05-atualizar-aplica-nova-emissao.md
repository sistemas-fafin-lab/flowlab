# 05: Atualizar aplica a nova emissão sozinho

**What to build:** Quando quem tem `canManageBilling` clica em **Atualizar** na aba Títulos, os títulos refechados apontados pela conferência (ticket 04) recebem a nova emissão na hora. O aviso passa a dizer "N títulos mudaram de mês por refechamento no apLIS", com operadora, lote(s), emissão antiga → nova. Meta mensal, histórico de metas, Dashboard e "Ver títulos do mês" refletem a mudança juntos, porque todos usam a emissão. Quem só visualiza continua vendo só o aviso do ticket 04, sem erro de permissão.

RPC nova que, numa transação só, atualiza `data_emissao` e, **só quando a competência era o mês da emissão antiga**, `competencia` (mesma regra da migration de 06/10). A RPC confere de novo no servidor que a nova data é de um **mês posterior** ao da atual (regra do ticket 04, decidida em 19/10/2026), para ser idempotente e segura contra corrida. Exige `canManageBilling` e devolve quantos e quais títulos mudaram. Vencimento não muda. Não há correção de dados à parte: os 5 lotes de outubro (mais o 5424, achado na conferência do ticket 04) entram no primeiro Atualizar depois do deploy. São 22 títulos no total, de vários meses: ver os Comments do ticket 04.

Spec: `.scratch/faturamento-pendencias-e-refechamento/spec.md`.

**Blocked by:** 04 (Conferência detecta título com lote refechado)

**Status:** ready-for-human — código pronto; falta aplicar a migration, rodar o primeiro Atualizar em produção e conferir a meta.

- [x] O Atualizar com `canManageBilling` aplica os refechamentos e mostra quais títulos mudaram de mês.
- [x] A competência acompanha só quando era o mês da emissão antiga. Uma competência diferente é preservada.
- [x] A RPC recusa sem `canManageBilling` e ignora título cuja nova data não é posterior à atual (rodar duas vezes não muda nada).
- [x] Título cancelado nunca é alterado.
- [x] Uma falha ao ler o apLIS ou ao aplicar não apaga a lista: ela continua com os dados anteriores e mostra o erro.
- [x] Teste da regra pura de competência. Prior art: `atualizarAplis.test.ts` e `emissaoTitulo.test.ts`.
- [ ] Conferido à mão: depois do primeiro Atualizar, a meta de out/2026 sobe cerca de R$ 51,7 mil, e o card bate com "Ver títulos do mês".

## Comments

**19/10/2026 — implementação.** Migration `20261019180000_fat_aplicar_refechamentos.sql` cria `fat_aplicar_refechamentos(p)`, com `p = [{ idNota, emissaoNova }]`. Exige `canManageBilling` e trava as linhas com `FOR UPDATE`. Só mexe em título não cancelado cuja nova data cai num mês posterior ao da emissão atual. Também recusa data futura (guarda a mais, já que a data vem do cliente). A competência só acompanha quando era o mês da emissão antiga. A RPC devolve só os títulos que mudaram. No front, `useConferenciaAplis.atualizar(aplicar)` lê a conferência uma vez e, para quem edita, aplica (`rpcAplicarRefechamentos`). A página mostra `RefechamentosAplicadosAviso` e relê a lista. Quem só visualiza não chama a RPC. Falha ao aplicar vira aviso de erro e não mexe na lista.

A regra pura de competência (`utils/refechamento.ts`, com teste) espelha o `CASE` da RPC. Quem aplica é o SQL.

A RPC não foi rodada contra um Postgres local. A validação fica no Supabase, junto com a conferência da meta de out/2026.
