# 10 — Sincronização com o Granola

**What to build:** a busca automática das reuniões.
- Um cron por dia útil chama `agente-sync-cron`. O botão "Buscar reuniões agora" chama `agente-sincronizar`.
- Os dois listam as notas da pasta configurada com `updated_after` = última sincronização, buscam cada nota nova, gravam em `ti_agente_reunioes` e analisam.
- Uma nota já guardada **não é analisada de novo** sozinha (D14). Só `fonte_atualizada_em` é atualizado, e isso acende o selo na lista.

Para caber no tempo da function, cada execução só começa uma análise nova se ainda restarem 4,5 minutos. É o pior caso com a reserva: Claude com 2 tentativas de 90 s, mais 90 s do Gemini (plano RNF03). As restantes ficam `pendente` para a próxima execução ou para o botão.

Plano: §3 (Granola e Vercel), §4.2 (RF12), §5 (Fluxo 1), §16 (cron `0 12 * * 1-5`) e RNF03.

**Blocked by:** 08. Para rodar de verdade, também a 04.

**Status:** done no código (13/Out/2026); falta conferir o cron no primeiro deploy (04)

- [ ] Ação `agente-sync-cron`: GET, `CRON_SECRET`, `dryRun` (lista o que faria sem gravar).
- [ ] Ação `agente-sincronizar`: POST com sessão e `canManageIT`; mesma rotina.
- [ ] Sincronização idempotente por `granola_note_id`. O cursor só avança quando a execução termina sem erro.
- [ ] `realizada_em` vem do `calendar_event.scheduled_start_time` ou, sem evento, do `created_at` da nota.
- [ ] Notas com `deleted_at` são ignoradas.
- [ ] Cron no `vercel.json`. Conferir no deploy que o Hobby aceita `1-5` (uma vez por dia).
- [ ] Botão "Buscar reuniões agora" na aba Reuniões, com o resultado ("2 novas, 1 atualizada").
- [ ] Situação na aba Configurações: última sincronização e último erro.
- [ ] Chip "Granola · sincronizado às HH:mm" no Início (`EvaControls`), lido de `ti_agente_config`. Verde quando sincronizou nas últimas 24 h úteis; vermelho com o último erro.

## Comments

**13/Out/2026 — implementado no código.**
- **Rotina** (`api/_lib/ti-agente/sincronizar.ts`), usada pelas duas ações:
  - `agente-sync-cron`: GET, com `CRON_SECRET` e `dryRun`;
  - `agente-sincronizar`: POST, com sessão e `canManageIT` ou `canApproveAgenteTI`.
- **Comportamento:**
  - idempotente por `granola_note_id`;
  - nota já guardada só atualiza `fonte_atualizada_em` (D14);
  - nota sem resumo fica para a próxima execução;
  - `realizada_em` vem do evento da agenda ou, sem ele, da criação da nota;
  - notas com `deleted_at` são ignoradas.
- **Tempo da function:** uma análise nova só começa se ainda restarem 270 s dos 300 s. Uma reunião presa em "analisando" há mais de 10 min volta para a fila.
- **Botão "Buscar reuniões agora"** na aba Reuniões, com "N novas, N atualizadas".
- **Situação (correção feita nesta issue):** `granola_ultima_sync_em` é o cursor, o maior `updated_at` de nota visto, não a hora da execução. Usado no chip, ele acenderia vermelho numa semana sem nota nova, mesmo com o cron rodando. A migration ganhou duas colunas:
  - `granola_verificado_em`: fim da última execução sem erro;
  - `granola_ultimo_erro`: erro da última execução, ou NULL.
  
  A migration ainda não foi aplicada. O `ADD COLUMN IF NOT EXISTS` cobre quem já tiver criado a tabela.
- **Chip do Início** (`domain/integracoes.ts`, testado):
  - verde, "sincronizado 13/10 às 09:00";
  - vermelho, "erro na última sincronização", ou "sem sincronizar desde…" depois de 4 dias sem execução (cobre um fim de semana mais um dia útil);
  - cinza: "ainda não configurado" ou "aguardando a 1ª sincronização".
- **Configurações:** mostra a última sincronização e o erro, quando houver.
- **Falta:** conferir no primeiro deploy se o Hobby aceita o cron `0 12 * * 1-5`.
