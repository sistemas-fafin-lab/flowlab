#!/usr/bin/env bash
# Instala a fila de WhatsApp da EVA como systemd timer (a cada minuto), na VPS do WAHA.
# Roda a partir de um checkout do repositório FlowLAB (REPO_DIR) com node_modules instalado,
# como tools/quotation-approval-digest/. As chaves ficam num arquivo de ambiente 600
# (/etc/flowlab/eva-whatsapp.env), não nas units, que qualquer usuário da máquina lê.
#
# Uso:
#   sudo REPO_DIR=/opt/flowlab \
#        SUPABASE_URL=https://<projeto-do-app>.supabase.co \
#        SUPABASE_SERVICE_ROLE_KEY=<service-role> \
#        WAHA_API_KEY=<chave-do-waha> \
#        ./install.sh
#   (WAHA_URL padrão: http://127.0.0.1:3000; WAHA_SESSION padrão: eva)
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode com sudo." >&2
  exit 1
fi

: "${REPO_DIR:?defina REPO_DIR (checkout do repo flowlab com node_modules instalado)}"
: "${SUPABASE_URL:?defina SUPABASE_URL (projeto do app)}"
: "${SUPABASE_SERVICE_ROLE_KEY:?defina SUPABASE_SERVICE_ROLE_KEY}"
: "${WAHA_API_KEY:?defina WAHA_API_KEY}"
WAHA_URL="${WAHA_URL:-http://127.0.0.1:3000}"
WAHA_SESSION="${WAHA_SESSION:-eva}"

case "$WAHA_URL" in
  *ngrok*) echo "WAHA_URL não pode ser a URL do ngrok: use o localhost da VPS (http://127.0.0.1:3000)." >&2; exit 1 ;;
esac

if [ ! -f "$REPO_DIR/tools/agente-ti-whatsapp/send-outbox.ts" ]; then
  echo "REPO_DIR ($REPO_DIR) não parece ser um checkout do flowlab com a EVA." >&2
  exit 1
fi

NODE_BIN="${NODE_BIN:-$(command -v node)}"
NPX_BIN="${NPX_BIN:-$(command -v npx)}"
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

echo "→ Criando unidades systemd"
cat > /etc/systemd/system/flowlab-eva-whatsapp.service <<EOF
[Unit]
Description=FlowLAB — EVA: fila de WhatsApp (envio pelo WAHA local)
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$REPO_DIR
Environment=PATH=/usr/bin:/usr/local/bin:$(dirname "$NODE_BIN")
EnvironmentFile=$ENV_FILE
ExecStart=$NPX_BIN tsx tools/agente-ti-whatsapp/send-outbox.ts
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
echo "  sudo bash -c 'set -a; . $ENV_FILE; cd $REPO_DIR && $NPX_BIN tsx tools/agente-ti-whatsapp/send-outbox.ts --dry-run'"
echo "Logs:"
echo "  journalctl -u flowlab-eva-whatsapp.service -n 50 --no-pager"
