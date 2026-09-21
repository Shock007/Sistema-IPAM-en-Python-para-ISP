"""
Configuración global del proyecto.
Lee variables de entorno (.env) para permitir cambiar entre PostgreSQL y MySQL
sin tocar código.
"""
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://ipam:ipam@localhost:5432/ipam_db",
)

SQL_ECHO: bool = os.getenv("SQL_ECHO", "false").lower() == "true"
