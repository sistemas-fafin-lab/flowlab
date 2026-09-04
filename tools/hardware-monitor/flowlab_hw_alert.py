#!/usr/bin/env python3
"""Monitor de hardware — FlowLAB.

Dois modos de operação, definidos por variável de ambiente:

1. Modo local (padrão, sem GLANCE_AGENTS):
   Coleta CPU / RAM / disco / temperatura da própria máquina via psutil.
   Usar quando não há Glance Agent na máquina.

2. Modo central (com GLANCE_AGENTS definido):
   Consulta N Glance Agents via HTTP (GET /api/sysinfo/all) e consolida as
   máquinas que estouraram os limites em um único e-mail.
   Formato: GLANCE_AGENTS="nome1|http://ip1:27973|token1,nome2|http://ip2:27973"
   (nome e token são opcionais: "|http://ip:27973" usa o hostname do agent;
   sem o terceiro campo, sem token).

Em ambos os modos, quando alguma métrica passa do limite configurado, o
script faz POST para a API do FlowLAB (POST /api/notifications/email), que
envia o e-mail usando o template Supabase `hardware_alert`.

Modos de uso:
  - loop (padrão):  checa a cada CHECK_INTERVAL_S — para rodar como serviço.
  - --once:         faz uma única checagem e sai — para cron/Task Scheduler.
  - --dry-run:      mostra o payload que seria enviado, sem enviar nada.
  - --test:         força o envio de um e-mail de teste (ignora limites).

Configuração via variáveis de ambiente (ver README.md). Exemplo local:
  FLOWLAB_API_URL=https://flowlab.ngrok.app ALERT_TO=voce@empresa.com \
    python3 flowlab_hw_alert.py --once --dry-run

Exemplo central:
  GLANCE_AGENTS="servidor-1|http://10.0.0.5:27973|segredo" \
    FLOWLAB_API_URL=https://flowlab.ngrok.app ALERT_TO=voce@empresa.com \
    python3 flowlab_hw_alert.py --once --dry-run

Dependência fora da stdlib: psutil — somente no modo local (pip install psutil).
O modo central usa apenas a biblioteca padrão.
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


def parse_agents(raw: str) -> list[dict[str, str]]:
    """Interpreta GLANCE_AGENTS="nome|url|token,..." em uma lista de agents."""
    agents = []
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry:
            continue
        parts = [p.strip() for p in entry.split("|")]
        url = parts[1] if len(parts) > 1 else parts[0]
        name = parts[0] if len(parts) > 1 and parts[0] else ""
        token = parts[2] if len(parts) > 2 else ""
        if not url.startswith(("http://", "https://")):
            sys.stderr.write(f"[{SCRIPT_NAME}] Entrada GLANCE_AGENTS ignorada (URL inválida): {entry!r}\n")
            continue
        agents.append({"name": name, "url": url.rstrip("/"), "token": token})
    return agents


def load_config() -> dict[str, Any]:
    api_url = os.environ.get("FLOWLAB_API_URL", "").strip().rstrip("/")
    to_email = os.environ.get("ALERT_TO", "").strip()
    if not api_url or not to_email:
        sys.stderr.write(
            f"[{SCRIPT_NAME}] FLOWLAB_API_URL e ALERT_TO são obrigatórios.\n"
        )
        sys.exit(2)

    agents_raw = os.environ.get("GLANCE_AGENTS", "").strip()
    agents = parse_agents(agents_raw) if agents_raw else []
    if agents_raw and not agents:
        sys.stderr.write(f"[{SCRIPT_NAME}] GLANCE_AGENTS definido mas nenhuma entrada válida.\n")
        sys.exit(2)

    try:
        import psutil  # noqa: F401
        psutil_ok = True
    except ImportError:
        psutil_ok = False

    if not agents and not psutil_ok:
        sys.stderr.write(
            f"[{SCRIPT_NAME}] Sem GLANCE_AGENTS e sem psutil instalado.\n"
            f"Instale com `pip install psutil` ou configure GLANCE_AGENTS.\n"
        )
        sys.exit(2)

    return {
        "api_url": api_url,
        "to_email": to_email,
        "template_slug": os.environ.get("ALERT_TEMPLATE_SLUG", "hardware_alert").strip(),
        "machine_name": os.environ.get("MACHINE_NAME", "").strip() or socket.gethostname(),
        "agents": agents,
        "limits": {
            "cpu": _env_float("CPU_LIMIT_PCT", 90.0),
            "ram": _env_float("RAM_LIMIT_PCT", 90.0),
            "disk": _env_float("DISK_LIMIT_PCT", 90.0),
            "temp": _env_float("TEMP_LIMIT_C", 85.0),
        },
        "check_interval_s": max(_env_int("CHECK_INTERVAL_S", 60), 10),
        "cooldown_s": _env_int("COOLDOWN_MINUTES", 60) * 60,
        "http_timeout_s": _env_int("ALERT_TIMEOUT_S", 30),
        "agent_timeout_s": _env_int("AGENT_TIMEOUT_S", 10),
        "state_file": os.environ.get(
            "STATE_FILE",
            os.path.join(os.path.expanduser("~"), ".flowlab-hw-alert-state.json"),
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Coleta de métricas — modo local (psutil)
# ─────────────────────────────────────────────────────────────────────────────

def collect_local_metrics() -> dict[str, Any]:
    import psutil

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


# ─────────────────────────────────────────────────────────────────────────────
# Coleta de métricas — modo central (Glance Agent via HTTP)
# ─────────────────────────────────────────────────────────────────────────────

def collect_glance_metrics(
    agent: dict[str, str], timeout: int,
) -> dict[str, Any] | None:
    url = f"{agent['url']}/api/sysinfo/all"
    headers = {
        "User-Agent": f"{SCRIPT_NAME}/1.0 ({platform.system()})",
        # Pula a página de aviso quando o agent está atrás de túnel ngrok
        "ngrok-skip-browser-warning": "1",
    }
    if agent["token"]:
        headers["Authorization"] = f"Bearer {agent['token']}"

    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        sys.stderr.write(f"[{SCRIPT_NAME}] Agent {url} -> HTTP {err.code}\n")
        return None
    except (urllib.error.URLError, OSError, json.JSONDecodeError) as err:
        sys.stderr.write(f"[{SCRIPT_NAME}] Agent {url} inacessível: {err}\n")
        return None

    cpu = data.get("cpu", {})
    memory = data.get("memory", {})
    mountpoints = data.get("mountpoints", []) or []

    metrics: dict[str, Any] = {
        "cpu": cpu.get("load1_percent") if cpu.get("load_is_available") else None,
        "ram": memory.get("used_percent") if memory.get("memory_is_available") else None,
        "temp": (
            cpu.get("temperature_c")
            if cpu.get("temperature_is_available")
            else None
        ),
    }
    # Glance já ordena mountpoints por uso decrescente: o primeiro é o mais cheio
    if mountpoints:
        top = mountpoints[0]
        metrics["disk"] = top.get("used_percent")
        metrics["disk_mount"] = top.get("path", "")
    else:
        metrics["disk"] = None
        metrics["disk_mount"] = ""

    # Nome da máquina: o configurado, senão o reportado pelo agent
    metrics["machine"] = agent["name"] or data.get("hostname") or agent["url"]
    return metrics


def format_snapshot(metrics: dict[str, Any]) -> str:
    temp = f"{metrics['temp']}°C" if metrics["temp"] is not None else "n/d"
    disk = f"{metrics['disk']}%" if metrics["disk"] is not None else "n/d"
    cpu = f"{metrics['cpu']}%" if metrics["cpu"] is not None else "n/d"
    ram = f"{metrics['ram']}%" if metrics["ram"] is not None else "n/d"
    return f"CPU {cpu} | RAM {ram} | Disco {disk} | Temp {temp}"


# ─────────────────────────────────────────────────────────────────────────────
# Cooldown (evita flood de e-mails por métrica/máquina)
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
# Comparação com limites
# ─────────────────────────────────────────────────────────────────────────────

LIMIT_MAP = {
    "cpu": "CPU",
    "ram": "RAM",
    "disk": "Disco",
    "temp": "Temperatura",
}


def exceeded_metrics(
    machine: str, metrics: dict[str, Any], limits: dict[str, float], force: bool,
) -> list[tuple[str, str, float, float, str, str]]:
    """Tuplas (key, label, limit, value, unit, extra) das métricas estouradas."""
    over = []
    units = {"cpu": "%", "ram": "%", "disk": "%", "temp": "°C"}
    for key, label in LIMIT_MAP.items():
        value = metrics[key]
        if value is None:
            continue  # métrica não disponível nesta plataforma
        limit = limits[key]
        if force or value >= limit:
            extra = (
                f" ({metrics['disk_mount']})"
                if key == "disk" and metrics.get("disk_mount")
                else ""
            )
            over.append((key, label, limit, float(value), units[key], extra))
    return over


# ─────────────────────────────────────────────────────────────────────────────
# Checagem principal
# ─────────────────────────────────────────────────────────────────────────────

def run_check(config: dict[str, Any], dry_run: bool, force: bool) -> int:
    now = time.time()
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    # ── Coleta: modo central (Glance Agents) ou local (psutil) ──────────────
    machines: dict[str, dict[str, Any]] = {}
    if config["agents"]:
        for agent in config["agents"]:
            metrics = collect_glance_metrics(agent, config["agent_timeout_s"])
            if metrics is not None:
                machines[metrics["machine"]] = metrics
        if not machines:
            sys.stderr.write("[{SCRIPT_NAME}] Nenhum Glance Agent respondeu.\n")
            return 1
    else:
        metrics = collect_local_metrics()
        metrics["machine"] = config["machine_name"]
        machines[metrics["machine"]] = metrics

    # ── Comparação com limites ──────────────────────────────────────────────
    all_over: list[tuple[str, str, str, float, float, str, str]] = []
    for machine, metrics in machines.items():
        over = exceeded_metrics(machine, metrics, config["limits"], force)
        for (key, label, limit, value, unit, extra) in over:
            all_over.append((machine, key, label, limit, value, unit, extra))

    if not all_over:
        if force:
            sys.stderr.write("[{SCRIPT_NAME}] Nenhuma métrica disponível para teste.\n")
            return 1
        sys.stderr.write(
            f"[{SCRIPT_NAME}] OK — dentro dos limites "
            f"({len(machines)} máquina(s)).\n"
        )
        return 0

    # ── Cooldown por (máquina, métrica) — ignorado em --test ────────────────
    state = load_state(config["state_file"])
    to_send: list[tuple[str, str, str, float, float, str, str]] = []
    for item in all_over:
        state_key = f"{item[0]}|{item[1]}"
        if not force and now - state.get(state_key, 0.0) < config["cooldown_s"]:
            continue
        to_send.append(item)

    if not to_send:
        sys.stderr.write(
            f"[{SCRIPT_NAME}] Métricas acima do limite, mas dentro do cooldown "
            f"({config['cooldown_s'] // 60} min). Nada enviado.\n"
        )
        return 0

    details = "".join(
        f"<li><strong>{machine} — {label}:</strong> {value}{unit} "
        f"(limite {limit}{unit}){extra}</li>"
        for (machine, _key, label, limit, value, unit, extra) in to_send
    )
    # Snapshot só das máquinas que dispararam o alerta (em --test, todas entram)
    alert_machines = {m for m, *_rest in to_send}
    snapshots = [
        f"<strong>{machine}:</strong> {format_snapshot(metrics)}"
        for machine, metrics in machines.items()
        if machine in alert_machines
    ]
    variables = {
        "machine": ", ".join(dict.fromkeys(m for m, *_rest in to_send)),
        "data": now_str,
        "details": details,
        "snapshot": "<br/>".join(snapshots),
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
        for (machine, key, *_rest) in to_send:
            state[f"{machine}|{key}"] = now
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
        f"[{SCRIPT_NAME}] Iniciando loop — checagem a cada {config['check_interval_s']}s, "
        f"cooldown {config['cooldown_s'] // 60} min "
        f"({'central com ' + str(len(config['agents'])) + ' agent(s)' if config['agents'] else 'local/psutil'}).\n"
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
