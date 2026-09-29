"""
Fixtures compartidas para los tests de la API REST (Fase 3).

Usa una base de datos SQLite en memoria, aislada por test, e inyecta esa
sesión en la app mediante `dependency_overrides` (no toca la BD real
configurada en DATABASE_URL).
"""
import os
os.environ["SCHEDULER_ENABLED"] = "false"  # el TestClient no debe arrancar el scheduler real
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db, get_session_factory
from app.database import Base
from app.Models.client import Client
from app.Models.ip_address import IPAddress, IPStatus
from app.Models.subnet import Subnet

TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=TEST_ENGINE, autocommit=False, autoflush=False, future=True)


@pytest.fixture()
def db_session():
    """Crea todas las tablas, entrega una sesión limpia y las elimina al final."""
    Base.metadata.create_all(TEST_ENGINE)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(TEST_ENGINE)


@pytest.fixture()
def client(db_session):
    from app.api.rate_limit import pin_limiter
    from app.main import app

    pin_limiter.clear()

    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    # Las tareas en segundo plano abren su propia sesión: apuntarla al motor de test.
    app.dependency_overrides[get_session_factory] = lambda: TestingSessionLocal
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture()
def seed(db_session):
    """Datos base: una subred, un cliente y dos IPs (una FREE y una ASSIGNED)."""
    subnet = Subnet(cidr="192.168.1.0/24", name="Red de prueba")
    db_session.add(subnet)
    db_session.commit()
    db_session.refresh(subnet)

    cliente = Client(full_name="Juan Perez")
    db_session.add(cliente)
    db_session.commit()
    db_session.refresh(cliente)

    ip_free = IPAddress(ip_address="192.168.1.10", subnet_id=subnet.id, status=IPStatus.FREE)
    ip_assigned = IPAddress(
        ip_address="192.168.1.11",
        subnet_id=subnet.id,
        client_id=cliente.id,
        status=IPStatus.ASSIGNED,
    )
    db_session.add_all([ip_free, ip_assigned])
    db_session.commit()
    db_session.refresh(ip_free)
    db_session.refresh(ip_assigned)

    return {
        "subnet": subnet,
        "cliente": cliente,
        "ip_free": ip_free,
        "ip_assigned": ip_assigned,
    }