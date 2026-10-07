import os
from pathlib import Path
from dotenv import dotenv_values

ENV_PATH = Path(".env")

# Valores por defecto para generar comentarios descriptivos si el usuario los deja vacíos
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

def read_env_config() -> dict:
    if not ENV_PATH.exists():
        return {}
    
    config = dotenv_values(ENV_PATH)
    return {
        "database_url": config.get("DATABASE_URL"),
        "provider_pin": config.get("PROVIDER_PIN"),
        "scheduler_enabled": config.get("SCHEDULER_ENABLED", "true").lower() == "true" if config.get("SCHEDULER_ENABLED") else None,
        "scan_interval_hours": int(config.get("SCAN_INTERVAL_HOURS")) if config.get("SCAN_INTERVAL_HOURS") else None,
        "scan_concurrency": int(config.get("SCAN_CONCURRENCY")) if config.get("SCAN_CONCURRENCY") else None,
        "scan_timeout": int(config.get("SCAN_TIMEOUT")) if config.get("SCAN_TIMEOUT") else None,
        "wisphub_api_key": config.get("WISPHUB_API_KEY"),
        "wisphub_base_url": config.get("WISPHUB_BASE_URL"),
    }

def update_env_file(data: dict) -> tuple[bool, str | None]:
    mapping = {
        "DATABASE_URL": data.get("database_url"),
        "PROVIDER_PIN": data.get("provider_pin"),
        "SCHEDULER_ENABLED": "true" if data.get("scheduler_enabled") is True else ("false" if data.get("scheduler_enabled") is False else None),
        "SCAN_INTERVAL_HOURS": str(data["scan_interval_hours"]) if data.get("scan_interval_hours") is not None else None,
        "SCAN_CONCURRENCY": str(data["scan_concurrency"]) if data.get("scan_concurrency") is not None else None,
        "SCAN_TIMEOUT": str(data["scan_timeout"]) if data.get("scan_timeout") is not None else None,
        "WISPHUB_API_KEY": data.get("wisphub_api_key"),
        "WISPHUB_BASE_URL": data.get("wisphub_base_url"),
    }
    

    lines = []
    db_configured = False

    for key, value in mapping.items():
        if value and str(value).strip():
            lines.append(f"{key}={str(value).strip()}\n")
            if key == "DATABASE_URL":
                db_configured = True
        else:
            # Si el valor está vacío, se deja comentado en el archivo .env
            default_val = DEFAULT_ENV_TEMPLATE.get(key, "valor")
            lines.append(f"#{key}={default_val}\n")

    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.writelines(lines)

    # Actualizar variables de entorno en el proceso activo
    os.environ.clear()
    from dotenv import load_dotenv
    load_dotenv(ENV_PATH, override=True)

    warning_msg = None
    if not db_configured:
        warning_msg = "Cuidado, el programa podrá escanear las IP que usted facilite pero no se guardara el registro de ello en ningún lado."

    return db_configured, warning_msg