"""
Motor de base de datos, compatible con PostgreSQL y MySQL mediante
la misma URL de conexión (solo cambia el driver en DATABASE_URL).
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import DATABASE_URL, SQL_ECHO

# pool_pre_ping evita conexiones "muertas" en MySQL tras timeouts largos.
engine = create_engine(DATABASE_URL, echo=SQL_ECHO, pool_pre_ping=True, future=True)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)

Base = declarative_base()


def get_db():
    """Generador de sesión, usable como dependencia (FastAPI en Fase 3)
    o directamente con next(get_db())."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
