# Alerta de hardware → FlowLAB

Monitora **CPU, RAM, disco e temperatura**. Quando alguma métrica passa do
limite, faz `POST /api/notifications/email` na API do FlowLAB, que envia o
e-mail usando o template Supabase `hardware_alert`.

Dois modos de operação — o mesmo script:

- **Modo central (Glance)**: um único script consulta N **Glance Agents**
  ([glanceapp/agent](https://github.com/glanceapp/agent)) via HTTP
  (`GET /api/sysinfo/all`) e envia **um e-mail consolidado** com as máquinas
  que estouraram. Nada de Python nas máquinas monitoradas — só o binário do
  Glance Agent.
- **Modo local (psutil)**: o script roda na própria máquina monitorada, sem
  Glance. Única dependência: `pip install psutil`.

Funciona em **Linux, Windows e macOS** (Python 3.8+). Temperatura é
best-effort — no Windows tanto o psutil quanto o Glance Agent não expõem
sensor e a métrica é pulada.

## Modo central (Glance Agent)

1. Instale o **Glance Agent** em cada máquina monitorada (binário único,
   sem dependências). Opcionalmente configure um `token` no `agent.yml`.
2. Rode este script em **um** lugar só (um servidor, a sua máquina, etc.):

```bash
GLANCE_AGENTS="servidor-1|http://10.0.0.5:27973|TOKEN1,pc-financeiro|http://10.0.0.6:27973" \
  FLOWLAB_API_URL=https://flow-lab.vercel.app \
  ALERT_TO=voce@empresa.com \
  python3 flowlab_hw_alert.py
```

Formato de `GLANCE_AGENTS`: entradas separadas por vírgula, cada uma
`nome|url|token` — nome e token são opcionais (`|http://ip:27973` usa o
hostname reportado pelo agent; sem terceiro campo, sem token).

## Modo local (psutil)

```bash
pip install psutil
FLOWLAB_API_URL=https://flow-lab.vercel.app ALERT_TO=voce@empresa.com \
  MACHINE_NAME=servidor-2 python3 flowlab_hw_alert.py
```

## Configuração (variáveis de ambiente)

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `FLOWLAB_API_URL` | sim | — | Base da API do FlowLAB (Vercel ou VPS). Ex: `https://flowlab.ngrok.app` |
| `ALERT_TO` | sim | — | E-mail que recebe os alertas |
| `GLANCE_AGENTS` | não (central) | — | Lista `nome\|url\|token` dos Glance Agents (ativa o modo central) |
| `ALERT_TEMPLATE_SLUG` | não | `hardware_alert` | Slug do template em `notification_templates` |
| `MACHINE_NAME` | não | hostname | Só no modo local: nome exibido no alerta |
| `CPU_LIMIT_PCT` | não | `90` | Limite de CPU (%) |
| `RAM_LIMIT_PCT` | não | `90` | Limite de RAM (%) |
| `DISK_LIMIT_PCT` | não | `90` | Limite de disco (%) |
| `TEMP_LIMIT_C` | não | `85` | Limite de temperatura (°C) |
| `CHECK_INTERVAL_S` | não | `60` | Intervalo de checagem no modo loop |
| `COOLDOWN_MINUTES` | não | `60` | Tempo mínimo entre alertas da mesma métrica/máquina |
| `ALERT_TIMEOUT_S` | não | `30` | Timeout HTTP do POST pro FlowLAB |
| `AGENT_TIMEOUT_S` | não | `10` | Timeout HTTP por Glance Agent (modo central) |
| `STATE_FILE` | não | `~/.flowlab-hw-alert-state.json` | Onde guarda o cooldown |

## Template no Supabase

A migration `supabase/migrations/20260902120000_hardware_alert_template.sql`
cria o template `hardware_alert` com as variáveis `{{machine}}`, `{{data}}`,
`{{details}}` e `{{snapshot}}`. Aplique no Supabase (CLI ou SQL editor) antes
do primeiro alerta real.

## Teste

```bash
# 1) Só mostra o payload, sem enviar nada:
GLANCE_AGENTS="servidor-1|http://10.0.0.5:27973" \
  FLOWLAB_API_URL=https://flow-lab.vercel.app ALERT_TO=voce@empresa.com \
  python3 flowlab_hw_alert.py --once --dry-run

# 2) Envia um e-mail de teste (ignora limites e cooldown):
FLOWLAB_API_URL=https://flow-lab.vercel.app ALERT_TO=voce@empresa.com \
  python3 flowlab_hw_alert.py --test
```

## Agendamento

### Modo central — systemd timer (recomendado)

O `install.sh` cria um timer systemd que roda o monitor em `--once` a cada
minuto. Ele aceita o `GLANCE_AGENTS` via ambiente:

```bash
sudo GLANCE_AGENTS="servidor-1|http://10.0.0.5:27973|TOKEN" \
     FLOWLAB_API_URL=https://flow-lab.vercel.app \
     ALERT_TO=voce@empresa.com \
     ./install.sh
```

Sem o instalador: `crontab -e` com o modo `--once`:

```cron
* * * * * GLANCE_AGENTS="servidor-1|http://10.0.0.5:27973|TOKEN" FLOWLAB_API_URL=https://flow-lab.vercel.app ALERT_TO=voce@empresa.com /usr/bin/python3 /opt/flowlab-hw-alert/flowlab_hw_alert.py --once
```

### Modo local — Linux/macOS/Windows

```cron
# Linux/macOS — cron 1x/min
* * * * * FLOWLAB_API_URL=https://flow-lab.vercel.app ALERT_TO=voce@empresa.com MACHINE_NAME=servidor-1 /usr/bin/python3 /opt/flowlab-hw-alert/flowlab_hw_alert.py --once
```

```powershell
# Windows — Task Scheduler 1x/min
schtasks /Create /SC MINUTE /MO 1 /TN "FlowLAB Hardware Alert" /TR "cmd /c set FLOWLAB_API_URL=https://flow-lab.vercel.app&& set ALERT_TO=voce@empresa.com&& set MACHINE_NAME=pc-nome&& python C:\flowlab-hw-alert\flowlab_hw_alert.py --once"
```

Ou use o modo loop rodando o script via `pythonw` com o Agendador ativando
"At system startup".

## Observações de segurança

O endpoint `/api/notifications/email` do FlowLAB hoje é público (não exige
chave). Qualquer um que descubra a URL consegue disparar e-mails para
qualquer destinatário — para expor esse endpoint à internet vale proteger com
uma API key antes (ex: header `x-api-key` validado no handler). O agente em si
não carrega nenhum segredo do SMTP; ele só fala com a API.
