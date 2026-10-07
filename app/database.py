"""
Motor de base de datos, compatible con PostgreSQL y MySQL mediante
la misma URL de conexión (solo cambia el driver en DATABASE_URL).
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import DATABASE_URL, SQL_ECHO

Base = declarative_base()

if DATABASE_URL:
    # pool_pre_ping evita conexiones "muertas" en MySQL tras timeouts largos.
    engine = create_engine(DATABASE_URL, echo=SQL_ECHO, pool_pre_ping=True, future=True)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
else:
    engine = None
    SessionLocal = None

def get_db():
    if SessionLocal is None:
        yield None
        return
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()