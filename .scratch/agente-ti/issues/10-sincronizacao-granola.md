# 10 — Sincronização com o Granola

**What to build:** a busca automática das reuniões.
- Um cron por dia útil chama `agente-sync-cron`. O botão "Buscar reuniões agora" chama `agente-sincronizar`.
- Os dois listam as notas da pasta configurada com `updated_after` = última sincronização, buscam cada nota nova, gravam em `ti_agente_reunioes` e analisam.
- Uma nota já guardada **não é analisada de novo** sozinha (D14). Só `fonte_atualizada_em` é atualizado, e isso acende o selo na lista.

Para caber no tempo da function, cada execução só começa uma análise nova se ainda restarem 4 minutos. É o pior caso com a reserva: Claude com 2 tentativas de 90 s, mais 60 s do Gemini (plano RNF03). As restantes ficam `pendente` para a próxima execução ou para o botão.

Plano: §3 (Granola e Vercel), §4.2 (RF12), §5 (Fluxo 1), §16 (cron `0 12 * * 1-5`) e RNF03.

**Blocked by:** 08. Para rodar de verdade, também a 04.

**Status:** ready-for-agent

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
