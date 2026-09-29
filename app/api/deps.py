"""Dependencias compartidas por los routers de la API."""
from typing import Callable, Generator

from sqlalchemy.orm import Session

from app.database import SessionLocal


def get_db() -> Generator[Session, None, None]:
    """Sesión por request. OJO: según la versión de FastAPI, esta sesión
    puede cerrarse ANTES de ejecutar las BackgroundTasks; por eso las
    tareas en segundo plano deben abrir su propia sesión (ver
    get_session_factory)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_session_factory() -> Callable[[], Session]:
    """Fábrica de sesiones para tareas en segundo plano (sobrescribible en tests)."""
    return SessionLocal