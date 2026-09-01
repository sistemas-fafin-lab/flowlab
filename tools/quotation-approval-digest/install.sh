#!/usr/bin/env bash
# Instala o resumo diário de cotações pendentes como systemd timer (17h).
# Diferente do alerta de hardware (script standalone copiado para /opt), este
# script depende do código-fonte do domínio de cotações — roda a partir de um
# checkout do próprio repositório FlowLAB (REPO_DIR), não é copiado.
# Uso: sudo REPO_DIR=/opt/flowlab FLOWLAB_API_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ./install.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode com sudo." >&2
  exit 1
fi

: "${REPO_DIR:?defina REPO_DIR (checkout do repo flowlab com node_modules instalado)}"
: "${FLOWLAB_API_URL:?defina FLOWLAB_API_URL}"
: "${SUPABASE_URL:?defina SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?defina SUPABASE_SERVICE_ROLE_KEY}"

if [ ! -f "$REPO_DIR/tools/quotation-approval-digest/send-digest.ts" ]; then
  echo "REPO_DIR ($REPO_DIR) não parece ser um checkout do flowlab." >&2
  exit 1
fi

NODE_BIN="${NODE_BIN:-$(command -v node)}"
NPX_BIN="${NPX_BIN:-$(command -v npx)}"

VITE_APP_URL_LINE=""
if [ -n "${VITE_APP_URL:-}" ]; then
  VITE_APP_URL_LINE="Environment=VITE_APP_URL=$VITE_APP_URL"
fi

echo "→ Criando unidades systemd"

cat > /etc/systemd/system/flowlab-quotation-digest.service <<EOF
[Unit]
Description=FlowLAB — resumo diário de cotações pendentes
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$REPO_DIR
Environment=PATH=/usr/bin:/usr/local/bin:$(dirname "$NODE_BIN")
Environment=FLOWLAB_API_URL=$FLOWLAB_API_URL
Environment=SUPABASE_URL=$SUPABASE_URL
Environment=SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
$VITE_APP_URL_LINE
ExecStart=$NPX_BIN tsx tools/quotation-approval-digest/send-digest.ts
EOF

cat > /etc/systemd/system/flowlab-quotation-digest.timer <<'EOF'
[Unit]
Description=Dispara o resumo diário de cotações pendentes às 17h

[Timer]
OnCalendar=*-*-* 17:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

echo "→ Ativando timer"
systemctl daemon-reload
systemctl enable --now flowlab-quotation-digest.timer

echo
echo "Pronto. Próximas execuções:"
systemctl list-timers flowlab-quotation-digest.timer --no-pager

echo
echo "Para testar agora (sem esperar 17h):"
echo "  sudo systemctl start flowlab-quotation-digest.service"
echo "  journalctl -u flowlab-quotation-digest.service -n 20 --no-pager"
