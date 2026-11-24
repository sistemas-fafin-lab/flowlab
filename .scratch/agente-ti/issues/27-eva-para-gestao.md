# 27 — A EVA para a gestão: relatório, perguntas e alertas

**What to build:** pedido do usuário (13/Nov):
- "preciso que a EVA passe a me encaminhar no WhatsApp um relatório de gestão (diferente do de cobrança)";
- "ela precisa funcionar melhor para função de gestão".

Ele escolheu, nas quatro perguntas:
- **Frequência:** diário e semanal.
- **Quem recebe:** o gestor que marcar na aba Membros.
- **Conteúdo:** tudo (Kanban e atrasos, chamados dos usuários, pessoas e projetos, pendências do gestor).
- **Além do relatório:** pedir o relatório na hora, perguntas de gestão e alertas na hora.

Plano: §2 (D38) e §11.7.

**Blocked by:** 14 (cobrança, o cron da manhã), 18 (comandos pelo WhatsApp).

**Status:** done no código (13/Nov/2026). Falta aplicar a migration, publicar, reinstalar o pacote da VPS e conferir no WhatsApp.

- [x] **Painel** (`domain/gestao.ts`, `montarPainelGestao`):
  - as regras do Início e do painel das Solicitações de TI (SLA e tempo médio);
  - os últimos 7 dias e o período anterior; na segunda, a semana anterior.
- [x] **Relatório da manhã** (`gerarRelatoriosDeGestao`, no cron da cobrança):
  - o do dia nos dias úteis, e o da semana na segunda;
  - uma vez por dia por pessoa, com `dryRun`.
- [x] **"relatório" na hora:**
  - sem IA para "relatório" e "relatório da semana" (`lerPedidoDeRelatorio`);
  - a intenção `relatorio` para "como foi a semana?".
- [x] **Perguntas de gestão:** o PAINEL DE GESTÃO no contexto do gestor, no chat e no WhatsApp, com a regra de usar os números dele. Sem o painel, a pergunta é respondida assim mesmo.
- [x] **Alertas** (`detectarAlertas`, `verificarAlertas`):
  - o que dispara: chamado alto ou crítico fora do prazo para iniciar, card crítico que atrasou e projeto em risco;
  - uma vez por acontecimento, até 5 por dia, só no horário da EVA;
  - rodam no script da VPS a cada 10 min.
- [x] **Aba Membros:** "Recebe o relatório de gestão" e "Recebe alertas de gestão na hora", só para gestor com WhatsApp; selos na lista.
- [x] Migration `20261113150100_eva_relatorio_gestao.sql`.
- [ ] Aplicar a migration no projeto do app e publicar.
- [ ] Gerar o pacote da VPS (`npm run eva-build-outbox`), copiar e rodar o `install.sh`: os alertas dependem disso.
- [ ] Marcar as adesões na aba Membros e conferir:
  - o relatório da manhã (ou `GET /api/ti/agente-cobranca-cron?dryRun=true`, campo `relatorio`);
  - "relatório" e "como foi a semana?" pelo WhatsApp;
  - "quem está sobrecarregado?" no chat e no WhatsApp;
  - um alerta.

## Comments

**13/Nov/2026 — implementado no código.**
- **Conferido com o Claude real, dados fictícios.**
  - Nas 8 perguntas, a IA respondeu com os números do painel:
    - pelo WhatsApp: "quem está sobrecarregado?", "como está o Bruno?", "tem chamado fora do prazo?", "o que travou essa semana?" e "o que eu tenho hoje?";
    - no chat: "qual o tempo médio de resolução?" e "quem entregou mais?".
  - "Como foi a semana?" e "me manda o resumo da semana" viraram pedido de relatório. Cada resposta levou de 4 a 10 s.
  - **Ajuste depois do teste:** a IA leu o tempo do chamado fora do prazo como tempo de espera. O painel passou a dizer "aberto em 09/11, prazo para iniciar vencido há …".
- **Decisões tomadas na implementação, para conferir com o usuário:**
  - Na segunda, sai uma mensagem só, a da semana, que também traz o retrato de agora e a atenção do dia.
  - "Novos atrasos" são os que venceram desde o último dia útil.
  - Pessoa entra em "Atenção" com 3 ou mais atrasados.
  - Os alertas olham só os últimos 3 dias, para não disparar o histórico no primeiro dia.
  - Projeto em risco alerta uma vez por sprint e situação.
- **Testes:**
  - `domain/gestao.test.ts`: painel, textos, bloco da IA e alertas;
  - `ti-agente/gestao.test.ts`: destinatários, uma vez por dia, segunda, fim de semana, `dryRun`, horário e limite dos alertas;
  - `comandos.test.ts`: o atalho, a intenção, quem não é gestor, o painel no contexto, a falha de leitura e a ajuda;
  - `chat.test.ts`: o painel no contexto.
