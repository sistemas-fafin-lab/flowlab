# Fila de WhatsApp da EVA → WAHA local

Roda a cada minuto na VPS do WAHA. Grava a situação da sessão do WAHA em `ti_agente_config` (chip "Wa-ha" do Início) e envia as mensagens pendentes de `ti_agente_mensagens`: cobranças, lembretes, testes, confirmações e as mensagens do grupo da equipe. A cada 30 minutos, grava também a lista de grupos do número da EVA, para a escolha do grupo em Configurações.

Por que na VPS: o WAHA fica em `127.0.0.1:3000`, e a Vercel não alcança esse endereço. Expor a API do WAHA na internet daria a quem tivesse a chave controle total do número (plano, D9). A Vercel só grava as mensagens no banco; este script as envia pelo `localhost`.

A rotina fica em `api/_lib/ti-agente/outbox.ts`, com testes. Este diretório só traz o executável e o instalador.

## O que cada execução faz (plano §11.2)

1. Lê `GET /api/sessions/eva` e grava `waha_status` e `waha_verificado_em`. Isso roda mesmo com o envio desligado. Se o WAHA não responde, grava `INACESSIVEL`.
   - Com a sessão `WORKING`, relê a lista de grupos (`GET /api/eva/groups`) a cada 30 minutos e grava em `waha_grupos`. O botão "Atualizar lista" de Configurações pede a leitura no minuto seguinte. Uma falha aqui vai para o log e não impede o envio.
2. Marca como `falhou` as mensagens que venceram na fila, para não saírem atrasadas depois de uma queda longa. A cobrança da manhã só vale no próprio dia, porque diz "pendências de hoje"; as demais valem 12 h. Isso também roda com o envio desligado ou a sessão caída.
3. Fora do horário de cobrança (dia útil, das 7h às 20h de Brasília), reagenda as cobranças, os lembretes e as mensagens do grupo para a próxima janela; nunca saem no fim de semana. Teste e confirmação saem a qualquer hora.
4. Se o WhatsApp estiver desligado em **EVA → Configurações**, para por aí.
5. Se a sessão não estiver `WORKING`, também para, para não gastar tentativas.
6. Pega até 20 mensagens pendentes, das mais antigas para as mais novas.
7. Para cada uma:
   - mensagem do grupo da equipe (`chat_id_destino` = `…@g.us`): vai direto para o grupo. Um destino que não é grupo fica `falhou`;
   - se o membro ainda não tem `whatsapp_chat_id`, resolve com `check-exists` (o 9º dígito dos números brasileiros) e guarda;
   - número fora do WhatsApp ou membro sem número: a mensagem fica `falhou`, com aviso na aba Membros.
8. Envia com `POST /api/sendText`, esperando 1 a 3 s entre um envio e outro.
9. Se der certo, a mensagem fica `enviada`, com o id do WAHA. Se falhar, ganha nova tentativa depois de 1, 5 e 15 minutos. Na 4ª falha, fica `falhou`.

10. Por até 50 s, relê a fila a cada 5 s e repete os passos acima quando há mensagem pronta. Assim, a resposta da EVA a uma mensagem sai em segundos, e não no minuto seguinte. Com o envio desligado ou a sessão fora de `WORKING`, a execução termina logo.

**Se o WAHA ou a VPS caírem, o resto da EVA continua funcionando:** Início, chat, reuniões, sugestões, aprovações e o botão Cobrar. As mensagens esperam na fila e saem quando o WAHA voltar, se ainda estiverem dentro da validade.

O systemd não abre uma execução nova enquanto a anterior está rodando (`Type=oneshot`), então uma mensagem não sai duas vezes. A janela de 50 s termina antes do minuto seguinte, então o timer não pula nenhuma execução.

## Instalação (systemd)

Há dois modos. O recomendado é o **arquivo único**: a VPS não precisa de uma cópia do repositório nem de chave do GitHub, só de Node 18 ou mais novo.

### Arquivo único (recomendado)

1. Numa máquina com o repositório e `npm install` feito, gere o pacote:

   ```bash
   npm run eva-build-outbox
   ```

   Ele cria, em `tools/agente-ti-whatsapp/dist/` (pasta ignorada pelo git):
   - `eva-whatsapp.mjs`: o script com tudo dentro, cerca de 860 KB;
   - `install.sh`: o instalador, com fim de linha LF;
   - `versao.txt`: o commit que foi empacotado.

2. Copie os dois primeiros para a VPS:

   ```bash
   scp tools/agente-ti-whatsapp/dist/eva-whatsapp.mjs tools/agente-ti-whatsapp/dist/install.sh usuario@vps:~/
   ```

3. Na VPS, confira sem enviar nada. O esperado é `"sessao": "WORKING"`:

   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... WAHA_API_KEY=... node ~/eva-whatsapp.mjs --dry-run
   ```

4. Instale. O arquivo é copiado para `/opt/flowlab-eva/`:

   ```bash
   sudo ARQUIVO=~/eva-whatsapp.mjs \
        SUPABASE_URL=https://<projeto-do-app>.supabase.co \
        SUPABASE_SERVICE_ROLE_KEY=<service-role-do-app> \
        WAHA_API_KEY=<chave-do-waha> \
        bash ~/install.sh
   ```

**Para atualizar:** gere o pacote de novo, copie e rode o `install.sh` outra vez.

### Checkout do repositório

Com o repositório clonado na VPS e `npm ci` feito, troque `ARQUIVO=…` por `REPO_DIR=/caminho/do/flowlab`. O timer roda o `.ts` com `tsx`, e para atualizar basta `git pull && npm ci`.

### Nos dois modos

As chaves ficam em `/etc/flowlab/eva-whatsapp.env`, com permissão `600`. Elas não vão para as units do systemd, que qualquer usuário da máquina consegue ler.

Conferir o timer e os logs:

```bash
systemctl list-timers flowlab-eva-whatsapp.timer
journalctl -u flowlab-eva-whatsapp.service -n 50 --no-pager
```

O log só registra quando há envio, falha ou sessão fora do ar, para não encher o journal a cada minuto.

## Uso manual

```bash
# arquivo único
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... WAHA_API_KEY=... node eva-whatsapp.mjs --dry-run
# checkout do repositório
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... WAHA_API_KEY=... npx tsx tools/agente-ti-whatsapp/send-outbox.ts --dry-run
```

O `--dry-run` mostra a situação da sessão, se o envio está ligado e quantas mensagens esperam na fila. Não grava nem envia nada. Sem `--dry-run`, roda uma execução de verdade, que fica até 50 s olhando a fila. Para uma passada só, use `--uma-vez`.

O comando tem de rodar de dentro do checkout, ou apontar para o `eva-whatsapp.mjs`. Rodado na pasta pessoal, o `npx tsx tools/...` dá `ERR_MODULE_NOT_FOUND`.

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
| Lista de grupos vazia em Configurações | O número da EVA não está em nenhum grupo, a sessão não está `WORKING` ou a VPS roda um pacote anterior a 14/Out. Veja no `journalctl` se aparece "Não consegui ler os grupos do WAHA" |
| Mensagem do grupo parada em "Agendada" | Fora do horário (dia útil, 7h às 20h): ela sai na próxima janela |
