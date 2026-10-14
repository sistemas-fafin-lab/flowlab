# Fila de WhatsApp da EVA → WAHA local

Roda a cada minuto na VPS do WAHA. Grava a situação da sessão do WAHA em `ti_agente_config` (chip "Wa-ha" do Início) e envia as mensagens pendentes de `ti_agente_mensagens`: cobranças, lembretes, testes e confirmações.

Por que na VPS: o WAHA fica em `127.0.0.1:3000`, e a Vercel não alcança esse endereço. Expor a API do WAHA na internet daria a quem tivesse a chave controle total do número (plano, D9). A Vercel só grava as mensagens no banco; este script as envia pelo `localhost`.

A rotina fica em `api/_lib/ti-agente/outbox.ts`, com testes. Este diretório só traz o executável e o instalador.

## O que cada execução faz (plano §11.2)

1. Lê `GET /api/sessions/eva` e grava `waha_status` e `waha_verificado_em`. Isso roda mesmo com o envio desligado. Se o WAHA não responde, grava `INACESSIVEL`.
2. Marca como `falhou` as mensagens que venceram na fila, para não saírem atrasadas depois de uma queda longa. A cobrança da manhã só vale no próprio dia, porque diz "pendências de hoje"; as demais valem 12 h. Isso também roda com o envio desligado ou a sessão caída.
3. Se o WhatsApp estiver desligado em **EVA → Configurações**, para por aí.
4. Se a sessão não estiver `WORKING`, também para, para não gastar tentativas.
5. Pega até 20 mensagens pendentes, das mais antigas para as mais novas.
6. Para cada uma:
   - se o membro ainda não tem `whatsapp_chat_id`, resolve com `check-exists` (o 9º dígito dos números brasileiros) e guarda;
   - número fora do WhatsApp ou membro sem número: a mensagem fica `falhou`, com aviso na aba Membros.
7. Envia com `POST /api/sendText`, esperando 1 a 3 s entre um envio e outro.
8. Se der certo, a mensagem fica `enviada`, com o id do WAHA. Se falhar, ganha nova tentativa depois de 1, 5 e 15 minutos. Na 4ª falha, fica `falhou`.

**Se o WAHA ou a VPS caírem, o resto da EVA continua funcionando:** Início, chat, reuniões, sugestões, aprovações e o botão Cobrar. As mensagens esperam na fila e saem quando o WAHA voltar, se ainda estiverem dentro da validade.

O systemd não abre uma execução nova enquanto a anterior está rodando (`Type=oneshot`), então uma mensagem não sai duas vezes.

## Instalação (systemd)

Num checkout do repositório com `npm install` feito:

```bash
sudo REPO_DIR=/opt/flowlab \
     SUPABASE_URL=https://<projeto-do-app>.supabase.co \
     SUPABASE_SERVICE_ROLE_KEY=<service-role-do-app> \
     WAHA_API_KEY=<chave-do-waha> \
     ./tools/agente-ti-whatsapp/install.sh
```

As chaves ficam em `/etc/flowlab/eva-whatsapp.env`, com permissão `600`. Elas não vão para as units do systemd, que qualquer usuário da máquina consegue ler.

Conferir o timer e os logs:

```bash
systemctl list-timers flowlab-eva-whatsapp.timer
journalctl -u flowlab-eva-whatsapp.service -n 50 --no-pager
```

O log só registra quando há envio, falha ou sessão fora do ar, para não encher o journal a cada minuto.

## Uso manual

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... WAHA_API_KEY=... \
  npx tsx tools/agente-ti-whatsapp/send-outbox.ts --dry-run
```

O `--dry-run` mostra a situação da sessão, se o envio está ligado e quantas mensagens esperam na fila. Não grava nem envia nada. Sem `--dry-run`, roda uma execução de verdade.

Também dá para usar o script do `package.json`: `npm run eva-send-outbox -- --dry-run`.

## Variáveis de ambiente

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `SUPABASE_URL` | sim | — | Projeto do **app**, o mesmo do `VITE_SUPABASE_URL`. Não o de teste |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | — | Service role desse projeto |
| `WAHA_API_KEY` | sim | — | Chave de API do WAHA (`X-Api-Key`) |
| `WAHA_URL` | não | `http://127.0.0.1:3000` | O localhost da VPS. O script recusa uma URL do ngrok |
| `WAHA_SESSION` | não | `eva` | Sessão do número da EVA (+55 61 9992-4986) |

Nenhuma delas leva o prefixo `VITE_`.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Chip "Wa-ha · sem sinal da VPS" no Início | O timer parou ou não consegue falar com o Supabase. Veja o `journalctl` |
| Chip "Wa-ha · desconectado" ou "aguardando o QR code" | A sessão `eva` caiu no WAHA. Reconecte pelo painel |
| Mensagens paradas em "Agendada" | Envio desligado em Configurações, ou sessão fora de `WORKING` |
| "O número … não está no WhatsApp" na aba Membros | O número cadastrado está errado ou não tem WhatsApp |
