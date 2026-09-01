#!/usr/bin/env python3
"""Agente de monitoramento de hardware — FlowLAB.

Coleta CPU / RAM / disco / temperatura (via psutil) e, quando alguma métrica
passa do limite configurado, faz um POST para a API do FlowLAB
(POST /api/notifications/email), que envia o e-mail usando o template
Supabase `hardware_alert`.

Funciona em Linux, Windows e macOS. Temperatura é best-effort: depende de
suporte do psutil na plataforma (no Windows/macOS normalmente fica vazio e a
métrica é pulada).

Modos de uso:
  - loop (padrão):  checa a cada CHECK_INTERVAL_S — para rodar como serviço.
  - --once:         faz uma única checagem e sai — para cron/Task Scheduler.
  - --dry-run:      mostra o payload que seria enviado, sem enviar nada.
  - --test:         força o envio de um e-mail de teste (ignora limites).

Configuração via variáveis de ambiente (ver README.md). Exemplo:
  FLOWLAB_API_URL=https://flowlab.ngrok.app ALERT_TO=voce@empresa.com \
    python3 flowlab_hw_alert.py --once --dry-run

Dependência única fora da stdlib: pip install psutil
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import socket
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any

try:
    import psutil
except ImportError:  # pragma: no cover
    sys.stderr.write("psutil não encontrado. Instale com: pip install psutil\n")
    sys.exit(1)

SCRIPT_NAME = "flowlab-hw-alert"


# ─────────────────────────────────────────────────────────────────────────────
# Configuração (variáveis de ambiente)
# ─────────────────────────────────────────────────────────────────────────────

def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        sys.stderr.write(f"[{SCRIPT_NAME}] {name}={raw!r} inválido; usando {default}\n")
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        sys.stderr.write(f"[{SCRIPT_NAME}] {name}={raw!r} inválido; usando {default}\n")
        return default


def load_config() -> dict[str, Any]:
    api_url = os.environ.get("FLOWLAB_API_URL", "").strip().rstrip("/")
    to_email = os.environ.get("ALERT_TO", "").strip()
    if not api_url or not to_email:
        sys.stderr.write(
            f"[{SCRIPT_NAME}] FLOWLAB_API_URL e ALERT_TO são obrigatórios.\n"
        )
        sys.exit(2)

    return {
        "api_url": api_url,
        "to_email": to_email,
        "template_slug": os.environ.get("ALERT_TEMPLATE_SLUG", "hardware_alert").strip(),
        "machine_name": os.environ.get("MACHINE_NAME", "").strip() or socket.gethostname(),
        "limits": {
            "cpu": _env_float("CPU_LIMIT_PCT", 90.0),
            "ram": _env_float("RAM_LIMIT_PCT", 90.0),
            "disk": _env_float("DISK_LIMIT_PCT", 90.0),
            "temp": _env_float("TEMP_LIMIT_C", 85.0),
        },
        "check_interval_s": max(_env_int("CHECK_INTERVAL_S", 60), 10),
        "cooldown_s": _env_int("COOLDOWN_MINUTES", 60) * 60,
        "http_timeout_s": _env_int("ALERT_TIMEOUT_S", 30),
        "state_file": os.environ.get(
            "STATE_FILE",
            os.path.join(os.path.expanduser("~"), ".flowlab-hw-alert-state.json"),
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Coleta de métricas
# ─────────────────────────────────────────────────────────────────────────────

def collect_metrics() -> dict[str, Any]:
    metrics: dict[str, Any] = {}

    # CPU (interval=1 dá uma leitura real, não média desde a última chamada)
    metrics["cpu"] = round(psutil.cpu_percent(interval=1), 1)

    # RAM
    metrics["ram"] = round(psutil.virtual_memory().percent, 1)

    # Disco: maior uso entre as partições acessíveis
    max_disk, disk_mount = 0.0, ""
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
        except (PermissionError, OSError):
            continue
        if usage.percent > max_disk:
            max_disk, disk_mount = usage.percent, part.mountpoint
    metrics["disk"] = round(max_disk, 1)
    metrics["disk_mount"] = disk_mount

    # Temperatura: maior valor entre todos os sensores expostos pelo SO
    max_temp: float | None = None
    for entries in psutil.sensors_temperatures().values():
        for entry in entries:
            if entry.current is not None and (max_temp is None or entry.current > max_temp):
                max_temp = entry.current
    metrics["temp"] = round(max_temp, 1) if max_temp is not None else None

    return metrics


def format_snapshot(metrics: dict[str, Any]) -> str:
    temp = f"{metrics['temp']}°C" if metrics["temp"] is not None else "n/d"
    disk = f"{metrics['disk']}%" if metrics["disk_mount"] else "n/d"
    return f"CPU {metrics['cpu']}% | RAM {metrics['ram']}% | Disco {disk} | Temp {temp}"


# ─────────────────────────────────────────────────────────────────────────────
# Cooldown (evita flood de e-mails por métrica)
# ─────────────────────────────────────────────────────────────────────────────

def load_state(path: str) -> dict[str, float]:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def save_state(path: str, state: dict[str, float]) -> None:
    try:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(state, fh)
    except OSError as err:
        sys.stderr.write(f"[{SCRIPT_NAME}] Não foi possível salvar o estado em {path}: {err}\n")


# ─────────────────────────────────────────────────────────────────────────────
# Envio do alerta para o FlowLAB
# ─────────────────────────────────────────────────────────────────────────────

def send_alert(config: dict[str, Any], variables: dict[str, str]) -> bool:
    payload = {
        "to": config["to_email"],
        "templateSlug": config["template_slug"],
        "variables": variables,
    }
    url = f"{config['api_url']}/api/notifications/email"
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": f"{SCRIPT_NAME}/1.0 ({platform.system()})",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=config["http_timeout_s"]) as resp:
            sys.stderr.write(f"[{SCRIPT_NAME}] POST {url} -> {resp.status}\n")
            return resp.status < 400
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        sys.stderr.write(f"[{SCRIPT_NAME}] POST {url} -> {err.code}: {body}\n")
        return False
    except urllib.error.URLError as err:
        sys.stderr.write(f"[{SCRIPT_NAME}] Falha de rede ao chamar {url}: {err.reason}\n")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Checagem principal
# ─────────────────────────────────────────────────────────────────────────────

def run_check(config: dict[str, Any], dry_run: bool, force: bool) -> int:
    metrics = collect_metrics()
    now = time.time()
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    # Quais métricas estouraram (ou tudo, em modo --test)
    limit_map = {
        "cpu": (config["limits"]["cpu"], "CPU", "%"),
        "ram": (config["limits"]["ram"], "RAM", "%"),
        "disk": (config["limits"]["disk"], "Disco", "%"),
        "temp": (config["limits"]["temp"], "Temperatura", "°C"),
    }
    over = []
    for key, (limit, label, unit) in limit_map.items():
        value = metrics[key]
        if value is None:
            continue  # métrica não disponível nesta plataforma
        if force or value >= limit:
            extra = f" ({metrics['disk_mount']})" if key == "disk" and metrics["disk_mount"] else ""
            over.append((key, label, limit, value, unit, extra))

    if not over:
        if force:
            sys.stderr.write("[{SCRIPT_NAME}] Nenhuma métrica disponível para teste.\n")
            return 1
        sys.stderr.write(
            f"[{SCRIPT_NAME}] OK — dentro dos limites. {format_snapshot(metrics)}\n"
        )
        return 0

    # Respeita o cooldown por métrica (ignorado em --test)
    state = load_state(config["state_file"])
    to_send = []
    for item in over:
        key = item[0]
        if not force and now - state.get(key, 0.0) < config["cooldown_s"]:
            continue
        to_send.append(item)

    if not to_send:
        sys.stderr.write(
            f"[{SCRIPT_NAME}] Métricas acima do limite, mas dentro do cooldown "
            f"({config['cooldown_s'] // 60} min). Nada enviado.\n"
        )
        return 0

    details = "".join(
        f"<li><strong>{label}:</strong> {value}{unit} (limite {limit}{unit}){extra}</li>"
        for (_key, label, limit, value, unit, extra) in to_send
    )
    variables = {
        "machine": config["machine_name"],
        "data": now_str,
        "details": details,
        "snapshot": format_snapshot(metrics),
    }

    if dry_run:
        print(json.dumps(
            {
                "to": config["to_email"],
                "templateSlug": config["template_slug"],
                "variables": variables,
            },
            indent=2,
            ensure_ascii=False,
        ))
        return 0

    ok = send_alert(config, variables)
    if ok and not force:
        for key, *_rest in to_send:
            state[key] = now
        save_state(config["state_file"], state)
    return 0 if ok else 1


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Alerta de hardware via FlowLAB (POST /api/notifications/email)."
    )
    parser.add_argument("--once", action="store_true", help="uma checagem e sai (cron)")
    parser.add_argument("--dry-run", action="store_true", help="mostra o payload sem enviar")
    parser.add_argument("--test", action="store_true", help="envia e-mail de teste ignorando limites")
    args = parser.parse_args()

    config = load_config()

    if args.test and args.dry_run:
        sys.stderr.write("[{SCRIPT_NAME}] --test e --dry-run não podem ser usados juntos.\n")
        return 2

    if args.once or args.test or args.dry_run:
        return run_check(config, dry_run=args.dry_run, force=args.test)

    sys.stderr.write(
        f"[{SCRIPT_NAME}] Iniciando loop — máquina {config['machine_name']}, "
        f"checagem a cada {config['check_interval_s']}s, cooldown {config['cooldown_s'] // 60} min.\n"
    )
    try:
        while True:
            run_check(config, dry_run=False, force=False)
            time.sleep(config["check_interval_s"])
    except KeyboardInterrupt:
        sys.stderr.write(f"[{SCRIPT_NAME}] Encerrado.\n")
        return 0


if __name__ == "__main__":
    sys.exit(main())
