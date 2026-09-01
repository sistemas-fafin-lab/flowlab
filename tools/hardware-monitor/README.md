# Alerta de hardware → FlowLAB

Agente que roda em cada máquina e monitora **CPU, RAM, disco e temperatura**.
Quando alguma métrica passa do limite, ele faz `POST /api/notifications/email`
na API do FlowLAB, que envia o e-mail usando o template Supabase `hardware_alert`.

Funciona em **Linux, Windows e macOS** (Python 3.8+). Temperatura é
best-effort — no Windows/macOS o psutil normalmente não expõe sensores e a
métrica é pulada.

## Instalação

```bash
pip install psutil        # única dependência
```

Copie `flowlab_hw_alert.py` para a máquina (ou clone o repo) e configure as
variáveis de ambiente abaixo.

## Configuração (variáveis de ambiente)

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `FLOWLAB_API_URL` | sim | — | Base da API do FlowLAB (Vercel ou VPS). Ex: `https://flowlab.ngrok.app` |
| `ALERT_TO` | sim | — | E-mail que recebe os alertas |
| `ALERT_TEMPLATE_SLUG` | não | `hardware_alert` | Slug do template em `notification_templates` |
| `MACHINE_NAME` | não | hostname | Nome exibido no alerta (útil para diferenciar as máquinas) |
| `CPU_LIMIT_PCT` | não | `90` | Limite de CPU (%) |
| `RAM_LIMIT_PCT` | não | `90` | Limite de RAM (%) |
| `DISK_LIMIT_PCT` | não | `90` | Limite de disco (%) |
| `TEMP_LIMIT_C` | não | `85` | Limite de temperatura (°C) |
| `CHECK_INTERVAL_S` | não | `60` | Intervalo de checagem no modo loop |
| `COOLDOWN_MINUTES` | não | `60` | Tempo mínimo entre alertas da mesma métrica |
| `ALERT_TIMEOUT_S` | não | `30` | Timeout HTTP do POST |
| `STATE_FILE` | não | `~/.flowlab-hw-alert-state.json` | Onde guarda o cooldown |

## Template no Supabase

A migration `supabase/migrations/20260901120000_hardware_alert_template.sql`
cria o template `hardware_alert` com as variáveis `{{machine}}`, `{{data}}`,
`{{details}}` e `{{snapshot}}`. Aplique no Supabase (CLI ou SQL editor) antes
do primeiro alerta real.

## Teste

```bash
# 1) Só mostra o payload, sem enviar nada:
FLOWLAB_API_URL=https://flowlab.ngrok.app ALERT_TO=voce@empresa.com \
  python3 flowlab_hw_alert.py --once --dry-run

# 2) Envia um e-mail de teste (ignora limites e cooldown):
FLOWLAB_API_URL=https://flowlab.ngrok.app ALERT_TO=voce@empresa.com \
  python3 flowlab_hw_alert.py --test
```

## Agendamento

### Linux (systemd timer — recomendado)

O `install.sh` cria um timer systemd que roda o agente em modo `--once` a
cada minuto (sem processo sempre vivo):

```bash
sudo FLOWLAB_API_URL=https://flow-lab.vercel.app \
     ALERT_TO=voce@empresa.com \
     MACHINE_NAME=servidor-1 \
     ./install.sh
```

Ele copia o script para `/opt/flowlab-hw-alert`, cria
`flowlab-hw-alert.{service,timer}`, ativa o timer e roda a primeira checagem.

Sem o instalador: `crontab -e` com o modo `--once`:

```cron
* * * * * FLOWLAB_API_URL=https://flowlab.ngrok.app ALERT_TO=voce@empresa.com MACHINE_NAME=servidor-1 /usr/bin/python3 /opt/flowlab-hw-alert/flowlab_hw_alert.py --once
```

### macOS (launchd ou cron)

```cron
* * * * * FLOWLAB_API_URL=https://flowlab.ngrok.app ALERT_TO=voce@empresa.com MACHINE_NAME=mac-lucas /usr/bin/python3 /opt/flowlab-hw-alert/flowlab_hw_alert.py --once
```

### Windows (Task Scheduler)

```powershell
schtasks /Create /SC MINUTE /MO 1 /TN "FlowLAB Hardware Alert" /TR "cmd /c set FLOWLAB_API_URL=https://flowlab.ngrok.app && set ALERT_TO=voce@empresa.com && set MACHINE_NAME=pc-financeiro && python C:\flowlab-hw-alert\flowlab_hw_alert.py --once"
```

Ou use o modo loop rodando o script via `pythonw` com o Agendador ativando
"At system startup".

## Observações de segurança

O endpoint `/api/notifications/email` do FlowLAB hoje é público (não exige
chave). Qualquer um que descubra a URL consegue disparar e-mails para
qualquer destinatário — para expor esse endpoint à internet vale proteger com
uma API key antes (ex: header `x-api-key` validado no handler). O agente em si
não carrega nenhum segredo do SMTP; ele só fala com a API.
