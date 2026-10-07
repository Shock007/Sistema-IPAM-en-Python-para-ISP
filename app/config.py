"""
Configuración global del proyecto.
Lee variables de entorno (.env) para permitir cambiar entre PostgreSQL y MySQL
sin tocar código.
"""
import os
from dotenv import load_dotenv


load_dotenv(override=True)

# Configuración de la base de datos (PostgreSQL o MySQL) según .env

DATABASE_URL: str | None = os.getenv("DATABASE_URL")
SQL_ECHO: bool = os.getenv("SQL_ECHO", "false").lower() == "true"

# PIN de autorización para consultas vía Sockets TCP (ver app/services/authorization.py).
# Mecanismo temporal, mientras el proveedor no defina un flujo real
# (token firmado, API key, OAuth, lista blanca de IPs, etc.).

PROVIDER_PIN: str | None = os.getenv("PROVIDER_PIN")

# --- Automatización (APScheduler) ---------------------------------------

SCHEDULER_ENABLED: bool = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"
SCAN_INTERVAL_HOURS: int = int(os.getenv("SCAN_INTERVAL_HOURS", "6")) if os.getenv("SCAN_INTERVAL_HOURS") else 6
SCAN_CONCURRENCY: int = int(os.getenv("SCAN_CONCURRENCY", "30")) if os.getenv("SCAN_CONCURRENCY") else 30
SCAN_TIMEOUT: int = int(os.getenv("SCAN_TIMEOUT", "2")) if os.getenv("SCAN_TIMEOUT") else 2

# Configuración y conexión con Wisphub (API REST de terceros para auditoría de IP's).

WISPHUB_API_KEY: str | None = os.getenv("WISPHUB_API_KEY")
WISPHUB_BASE_URL: str | None = os.getenv("WISPHUB_BASE_URL")
