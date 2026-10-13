# 14 — Cobrança diária e sob demanda

**What to build:** as duas formas de a EVA cobrar pelo WhatsApp.

**Diária (a mensagem da manhã):**
- Em dia útil, o cron `agente-cobranca-cron` calcula as pendências de cada membro com as **mesmas regras do Início** (domínio da 02).
- Monta o texto pelo modelo fixo (D11, §10) e grava uma mensagem `cobranca` por membro na fila, com `chave_dia`.
- O script da VPS (12) envia.
- O `dryRun` devolve as mensagens montadas sem gravar. É a forma de conferir, antes de ligar, que as pendências batem com o Início.

**Sob demanda (o botão Cobrar/Lembrar do protótipo, D22):**
- No bloco "Atrasadas e cobranças" do Início, o botão chama `agente-cobrar`.
  - **Lembrar:** o próprio card, para quem tem `canManageIT`.
  - **Cobrar:** card de outra pessoa, só para `canApproveAgenteTI`.
- O servidor confere permissão, janela de 4 h por card e WhatsApp com adesão (RN16), e grava uma mensagem `cobranca_manual` com `enviada_por`.
- A tela segue o comportamento otimista do handoff: o botão vira "Cobrada", aparece "Cobrança enviada agora via WhatsApp", a mensagem entra na fila e o card Cobranças soma +1.

Plano: §2 (D11, D13, D22), §4.3 (RF18, RF25), §4.4 (RN12, RN16), §10, §12.1 e §14.1/§14.5.

**Blocked by:** 02, 03, 06, 12. A conferência em produção depende da 13.

**Status:** ready-for-agent

- [ ] `domain/cobranca.ts`, com testes:
  - `pendenciasPorMembro` (atrasadas, vencem hoje ou no próximo dia útil, paradas);
  - `montarMensagem` (seções vazias somem, até 8 itens mais "e outras N no Início", link do Início);
  - `montarCobrancaManual` (texto do protótipo + código do card);
  - `podeCobrar({ card, usuario, permissoes, ultimaManual, agora })`, com o motivo da recusa.
- [ ] Ação `agente-cobranca-cron`:
  - GET com `CRON_SECRET` e `dryRun`;
  - não faz nada em fim de semana, com o liga/desliga desligado ou para membro sem pendência;
  - `chave_dia` impede uma segunda cobrança no mesmo dia.
- [ ] Cron `0 11 * * 1-5` no `vercel.json`.
- [ ] Migration com `ti_agente_cobrancas_hoje()`: exige `canManageIT` e conta `cobranca` + `cobranca_manual` enviadas hoje, no dia de Brasília.
- [ ] Ação `agente-cobrar`:
  - POST com sessão;
  - 403 sem permissão, 409 dentro da janela de 4 h, 422 sem WhatsApp, cada um com mensagem clara;
  - uma mensagem por responsável do card.
- [ ] No Início:
  - `evaService.sendCharge` chama `agente-cobrar`;
  - o botão mostra Lembrar ou Cobrar conforme o dono do card, e fica desabilitado, com dica, quando não pode;
  - o "último contato da EVA" de cada atrasada vem da fila ("Cobrada às 10:12 · sem resposta", "Ainda não cobrada");
  - o indicador **Cobranças hoje** usa `ti_agente_cobrancas_hoje()` (função `SECURITY DEFINER` que só devolve a contagem, D24, §6.3), para quem não é gestor também ver o número;
  - o "último contato da EVA" nas atrasadas aparece **só para gestores** (D24).
- [ ] Link do Início com a URL pública do app (reaproveitar a variável já usada nos links dos e-mails).
- [ ] Situação na aba Configurações: última cobrança, quantas mensagens e quantas falhas.

## Comments

**13/Out/2026.** A cobrança sob demanda entrou com o protótipo (botão Cobrar/Lembrar). A diária continua como estava.
