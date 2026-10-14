#!/usr/bin/env bash
# Instala a fila de WhatsApp da EVA como systemd timer (a cada minuto), na VPS do WAHA.
# Dois modos:
#   ARQUIVO  → o arquivo único gerado por `npm run eva-build-outbox` (eva-whatsapp.mjs). Só
#              precisa de Node 18+; não clona o repositório. É copiado para /opt/flowlab-eva.
#   REPO_DIR → um checkout do repositório FlowLAB com node_modules instalado (roda com tsx),
#              como tools/quotation-approval-digest/.
# As chaves ficam num arquivo de ambiente 600 (/etc/flowlab/eva-whatsapp.env), não nas
# units, que qualquer usuário da máquina lê.
#
# Uso (arquivo único):
#   sudo ARQUIVO=./eva-whatsapp.mjs \
#        SUPABASE_URL=https://<projeto-do-app>.supabase.co \
#        SUPABASE_SERVICE_ROLE_KEY=<service-role> \
#        WAHA_API_KEY=<chave-do-waha> \
#        ./install.sh
# Uso (checkout): troque ARQUIVO=… por REPO_DIR=/caminho/do/flowlab.
#   (WAHA_URL padrão: http://127.0.0.1:3000; WAHA_SESSION padrão: eva)
# Para atualizar, rode de novo com o arquivo novo (as chaves são regravadas).
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode com sudo." >&2
  exit 1
fi

: "${SUPABASE_URL:?defina SUPABASE_URL (projeto do app)}"
: "${SUPABASE_SERVICE_ROLE_KEY:?defina SUPABASE_SERVICE_ROLE_KEY}"
: "${WAHA_API_KEY:?defina WAHA_API_KEY}"
WAHA_URL="${WAHA_URL:-http://127.0.0.1:3000}"
WAHA_SESSION="${WAHA_SESSION:-eva}"

case "$WAHA_URL" in
  *ngrok*) echo "WAHA_URL não pode ser a URL do ngrok: use o localhost da VPS (http://127.0.0.1:3000)." >&2; exit 1 ;;
esac

NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
if [ -z "$NODE_BIN" ]; then
  echo "Node não encontrado. Instale o Node 18 ou mais novo." >&2
  exit 1
fi
if ! "$NODE_BIN" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)'; then
  echo "Node $("$NODE_BIN" -v) é antigo: a EVA precisa do 18 ou mais novo." >&2
  exit 1
fi

if [ -n "${ARQUIVO:-}" ]; then
  if [ ! -f "$ARQUIVO" ]; then
    echo "ARQUIVO ($ARQUIVO) não existe. Gere com 'npm run eva-build-outbox' e copie para a VPS." >&2
    exit 1
  fi
  APP_DIR=/opt/flowlab-eva
  echo "→ Copiando $ARQUIVO para $APP_DIR/eva-whatsapp.mjs"
  install -d -m 755 "$APP_DIR"
  install -m 644 "$ARQUIVO" "$APP_DIR/eva-whatsapp.mjs"
  WORK_DIR="$APP_DIR"
  EXEC_START="$NODE_BIN $APP_DIR/eva-whatsapp.mjs"
  DRY_RUN="$NODE_BIN $APP_DIR/eva-whatsapp.mjs --dry-run"
else
  : "${REPO_DIR:?defina ARQUIVO (eva-whatsapp.mjs, recomendado) ou REPO_DIR (checkout do flowlab com node_modules)}"
  if [ ! -f "$REPO_DIR/tools/agente-ti-whatsapp/send-outbox.ts" ]; then
    echo "REPO_DIR ($REPO_DIR) não parece ser um checkout do flowlab com a EVA." >&2
    exit 1
  fi
  NPX_BIN="${NPX_BIN:-$(command -v npx)}"
  WORK_DIR="$REPO_DIR"
  EXEC_START="$NPX_BIN tsx tools/agente-ti-whatsapp/send-outbox.ts"
  DRY_RUN="$NPX_BIN tsx tools/agente-ti-whatsapp/send-outbox.ts --dry-run"
fi

ENV_FILE=/etc/flowlab/eva-whatsapp.env

echo "→ Gravando $ENV_FILE (só root lê)"
install -d -m 700 /etc/flowlab
umask 077
cat > "$ENV_FILE" <<EOF
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
WAHA_URL=$WAHA_URL
WAHA_API_KEY=$WAHA_API_KEY
WAHA_SESSION=$WAHA_SESSION
EOF
chmod 600 "$ENV_FILE"
umask 022

echo "→ Criando unidades systemd"
cat > /etc/systemd/system/flowlab-eva-whatsapp.service <<EOF
[Unit]
Description=FlowLAB — EVA: fila de WhatsApp (envio pelo WAHA local)
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$WORK_DIR
Environment=PATH=/usr/bin:/usr/local/bin:$(dirname "$NODE_BIN")
EnvironmentFile=$ENV_FILE
ExecStart=$EXEC_START
TimeoutStartSec=120
EOF

cat > /etc/systemd/system/flowlab-eva-whatsapp.timer <<'EOF'
[Unit]
Description=Dispara a fila de WhatsApp da EVA a cada minuto

[Timer]
OnCalendar=minutely
AccuracySec=5s
Persistent=false

[Install]
WantedBy=timers.target
EOF

echo "→ Ativando timer"
systemctl daemon-reload
systemctl enable --now flowlab-eva-whatsapp.timer

echo
echo "Pronto. Próximas execuções:"
systemctl list-timers flowlab-eva-whatsapp.timer --no-pager

echo
echo "Para conferir sem enviar nada:"
echo "  sudo bash -c 'set -a; . $ENV_FILE; cd $WORK_DIR && $DRY_RUN'"
echo "Logs:"
echo "  journalctl -u flowlab-eva-whatsapp.service -n 50 --no-pager"
