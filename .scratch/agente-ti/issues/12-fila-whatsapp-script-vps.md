# 12 — Fila de WhatsApp e script da VPS

**What to build:** o caminho de saída das mensagens, sem expor o WAHA (D9).
- A Vercel e a tela gravam mensagens `saida` + `pendente` em `ti_agente_mensagens`.
- O script `tools/agente-ti-whatsapp/send-outbox.ts`, num timer systemd a cada minuto, esvazia a fila pelo WAHA local:
  - resolve o `chatId` com `check-exists` (por causa do 9º dígito dos números brasileiros);
  - envia com intervalo de 1 a 3 s;
  - tenta de novo com atraso crescente;
  - respeita o liga/desliga geral.

Na tela, entram o botão **"Enviar teste"** por membro (RF19) e o **histórico** de mensagens (RF21) na aba Membros.

Plano: §2 (D9), §3 (WAHA e número), §4.3 (RF19 a RF21), §11.1 e §11.2.

**Blocked by:** 05, 07. A parte do Início (fila e chip) também precisa da 03.

**Status:** ready-for-agent

- [ ] `tools/agente-ti-whatsapp/send-outbox.ts`:
  - lê `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WAHA_URL`, `WAHA_API_KEY` e `WAHA_SESSION`;
  - segue os passos 1 a 5 da §11.2;
  - nenhuma chave aparece no log.
- [ ] `api/_lib/ti-agente/waha.ts`, ou um módulo compartilhado usado pelo script: `checkExists`, `sendText`, com `fetch` injetado e sem lançar exceção, mais testes.
- [ ] `install.sh` (molde: `tools/hardware-monitor/install.sh`) e `README.md` com o uso manual (`npx tsx …`) e como ver os logs.
- [ ] "Enviar teste": grava uma mensagem `teste` na fila para o membro. A tela acompanha o status até `enviada` ou `falhou`.
- [ ] Histórico por membro: enviadas, falhas (com o erro) e recebidas.
- [ ] Número que não existe no WhatsApp: `falhou` com aviso na tela de membros.
- [ ] Aviso de situação da sessão (§11.2, passo 6): a cada execução, grava `waha_status` e `waha_verificado_em` em `ti_agente_config`, mesmo com o liga/desliga desligado.
- [ ] No Início:
  - a **Fila do WhatsApp** (`WhatsAppQueueCard`) aparece **só para gestores** (D24), lendo `ti_agente_mensagens` com o nome do membro. Na visão Equipe, todas; na Minha visão, as do próprio gestor. Para os demais, o bloco some e as atrasadas ocupam a linha. Status: Agendada, Enviada, Falhou; Entregue/Lida chegam na 15;
  - o chip **Wa-ha** mostra "WhatsApp conectado" com `WORKING` e aviso recente, "sem sinal" se o último aviso tiver mais de 5 min, e o status cru nos outros casos.

## Comments
