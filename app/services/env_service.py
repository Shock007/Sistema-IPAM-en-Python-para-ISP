import os
import re
from pathlib import Path

from dotenv import dotenv_values

ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"

DEFAULT_ENV_TEMPLATE = {
    "DATABASE_URL": "postgresql+psycopg2://usuario:password@localhost:5432/ipam_db",
    "PROVIDER_PIN": "123456",
    "SCHEDULER_ENABLED": "true",
    "SCAN_INTERVAL_HOURS": "6",
    "SCAN_CONCURRENCY": "30",
    "SCAN_TIMEOUT": "2",
    "WISPHUB_API_KEY": "tu_api_key_aqui",
    "WISPHUB_BASE_URL": "https://api.wisphub.net/v1",
}
MANAGED_KEYS = list(DEFAULT_ENV_TEMPLATE)

# campo del request -> variable del .env
FIELD_TO_KEY = {
    "database_url": "DATABASE_URL",
    "provider_pin": "PROVIDER_PIN",
    "scheduler_enabled": "SCHEDULER_ENABLED",
    "scan_interval_hours": "SCAN_INTERVAL_HOURS",
    "scan_concurrency": "SCAN_CONCURRENCY",
    "scan_timeout": "SCAN_TIMEOUT",
    "wisphub_api_key": "WISPHUB_API_KEY",
    "wisphub_base_url": "WISPHUB_BASE_URL",
}


def _raw() -> dict:
    return dict(dotenv_values(ENV_PATH)) if ENV_PATH.exists() else {}


def _to_int(value, default):
    try:
        return int(value) if value else default
    except (TypeError, ValueError):
        return default


def _mask(value: str | None) -> str | None:
    if not value:
        return None
    return "••••" + value[-4:] if len(value) > 8 else "••••"


def _mask_url(url: str | None) -> str | None:
    if not url:
        return None
    return re.sub(r"(://[^:/@]+:)[^@]*@", r"\1••••@", url)


def public_config() -> dict:
    """Configuración SIN secretos. Valores efectivos (mismos defaults que config.py)."""
    raw = _raw()
    sched = raw.get("SCHEDULER_ENABLED")
    return {
        "database_url_set": bool(raw.get("DATABASE_URL")),
        "database_url_masked": _mask_url(raw.get("DATABASE_URL")),
        "provider_pin_set": bool(raw.get("PROVIDER_PIN")),
        "wisphub_api_key_set": bool(raw.get("WISPHUB_API_KEY")),
        "wisphub_api_key_masked": _mask(raw.get("WISPHUB_API_KEY")),
        "wisphub_base_url": raw.get("WISPHUB_BASE_URL") or None,
        "scheduler_enabled": True if not sched else sched.strip().lower() == "true",
        "scan_interval_hours": _to_int(raw.get("SCAN_INTERVAL_HOURS"), 6),
        "scan_concurrency": _to_int(raw.get("SCAN_CONCURRENCY"), 30),
        "scan_timeout": _to_int(raw.get("SCAN_TIMEOUT"), 2),
    }


read_env_config = public_config  # alias de compatibilidad


def update_env_file(data: dict) -> tuple[bool, str | None, bool]:
    """`data` = payload.model_dump(exclude_unset=True).

    - campo ausente / None -> se CONSERVA el valor actual
    - ""                   -> se QUITA (queda comentada)
    - valor                -> se reemplaza
    Retorna (db_configured, warning, restart_required).
    """
    current = _raw()

    def pick(field: str, key: str) -> str | None:
        v = data.get(field)
        if v is None:
            return current.get(key) or None
        if isinstance(v, bool):
            return "true" if v else "false"
        v = str(v).strip()
        if "\n" in v or "\r" in v:
            raise ValueError("Los valores no pueden contener saltos de línea.")
        return v or None

    mapping = {key: pick(field, key) for field, key in FIELD_TO_KEY.items()}

    # Conservar líneas ajenas (SQL_ECHO, comentarios, etc.).
    lines: list[str] = []
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            key = line.strip().lstrip("#").split("=", 1)[0].strip()
            if key not in MANAGED_KEYS:
                lines.append(line + "\n")

    for key, value in mapping.items():
        lines.append(f"{key}={value}\n" if value else f"#{key}={DEFAULT_ENV_TEMPLATE[key]}\n")

    tmp = ENV_PATH.with_suffix(".tmp")  # escritura atómica
    tmp.write_text("".join(lines), encoding="utf-8")
    tmp.replace(ENV_PATH)

    # Solo claves gestionadas; nunca se toca PATH ni el resto.
    for key, value in mapping.items():
        if value:
            os.environ[key] = value
        else:
            os.environ.pop(key, None)

    after = _raw()
    restart_required = any(current.get(k) != after.get(k) for k in MANAGED_KEYS)

    db_configured = bool(mapping["DATABASE_URL"])
    warning = None if db_configured else (
        "Cuidado, el programa podrá escanear las IP que usted facilite "
        "pero no se guardara el registro de ello en ningún lado."
    )
    return db_configured, warning, restart_required