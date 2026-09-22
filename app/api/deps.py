"""
Dependencias compartidas por los routers de la API.
"""
from typing import Generator

from sqlalchemy.orm import Session

from app.database import SessionLocal


def get_db() -> Generator[Session, None, None]:
    """Provee una sesión de base de datos por request.

    Se usa como dependencia de FastAPI (Depends(get_db)). El cierre de la
    sesión (finally) se ejecuta DESPUÉS de que las BackgroundTasks de la
    request hayan terminado, por lo que es seguro pasar `db` a una tarea
    en segundo plano (ver POST /api/v1/ips/scan).
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()