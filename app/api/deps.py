"""Dependencias compartidas por los routers de la API."""
from typing import Callable, Generator

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.database import SessionLocal

NO_DB_MSG = ("Base de datos no configurada. Define DATABASE_URL en "
             "'Variables de entorno' y reinicia el servidor.")


def get_db() -> Generator[Session, None, None]:
    """Sesión por request. Sin BD configurada -> 503."""
    if SessionLocal is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_DB_MSG)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_optional_db() -> Generator[Session | None, None, None]:
    """Para endpoints que funcionan sin persistencia (escaneo/consulta): db=None."""
    if SessionLocal is None:
        yield None
        return
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_session_factory() -> Callable[[], Session] | None:
    """Fábrica de sesiones para tareas en segundo plano (None si no hay BD)."""
    return SessionLocal