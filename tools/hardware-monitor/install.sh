#!/usr/bin/env bash
# Instala o agente de hardware do FlowLAB como systemd timer (checagem 1x/min).
# Uso: sudo FLOWLAB_API_URL=... ALERT_TO=... MACHINE_NAME=... ./install.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode com sudo." >&2
  exit 1
fi

: "${FLOWLAB_API_URL:?defina FLOWLAB_API_URL}"
: "${ALERT_TO:?defina ALERT_TO}"
MACHINE_NAME="${MACHINE_NAME:-$(hostname)}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/flowlab-hw-alert"
PYTHON_BIN="${PYTHON_BIN:-$(command -v python3)}"

echo "→ Instalando agente em $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cp "$SCRIPT_DIR/flowlab_hw_alert.py" "$INSTALL_DIR/"

echo "→ Criando unidades systemd (machine: $MACHINE_NAME)"

GLANCE_ENV_LINE=""
if [ -n "${GLANCE_AGENTS:-}" ]; then
  GLANCE_ENV_LINE="Environment=GLANCE_AGENTS=$GLANCE_AGENTS"
fi

cat > /etc/systemd/system/flowlab-hw-alert.service <<EOF
[Unit]
Description=FlowLAB hardware alert (single check)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
Environment=FLOWLAB_API_URL=$FLOWLAB_API_URL
Environment=ALERT_TO=$ALERT_TO
Environment=MACHINE_NAME=$MACHINE_NAME
$GLANCE_ENV_LINE
ExecStart=$PYTHON_BIN $INSTALL_DIR/flowlab_hw_alert.py --once
EOF

cat > /etc/systemd/system/flowlab-hw-alert.timer <<'EOF'
[Unit]
Description=Checa hardware a cada minuto

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
Persistent=true

[Install]
WantedBy=timers.target
EOF

echo "→ Ativando timer"
systemctl daemon-reload
systemctl enable --now flowlab-hw-alert.timer

echo "→ Rodando primeira checagem manualmente"
systemctl start flowlab-hw-alert.service || true

echo
echo "Pronto. Status:"
systemctl list-timers flowlab-hw-alert.timer --no-pager
echo
echo "Log da última checagem:"
journalctl -u flowlab-hw-alert.service -n 5 --no-pager
