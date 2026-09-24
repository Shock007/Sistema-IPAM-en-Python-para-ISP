"""
Punto de entrada de la API REST (Fase 3).

Ejecutar en desarrollo:
    uvicorn app.main:app --reload

Documentación interactiva:
    http://127.0.0.1:8000/docs
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routers.ips import router as ips_router
from app.api.routers.scheduler import router as scheduler_router
from app.config import SCHEDULER_ENABLED
from app.services.scheduler import shutdown_scheduler, start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    if SCHEDULER_ENABLED:
        start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(
    title="IPAM System API",
    description=(
        "API REST del sistema IPAM: gestión de direcciones IP, escaneo de "
        "red (PING) y asignación de titulares."
    ),
    version="0.4.0",
    lifespan=lifespan,
)

app.include_router(ips_router)
app.include_router(scheduler_router)


@app.get("/api/v1/health", tags=["health"])
def health_check() -> dict:
    """Chequeo simple de disponibilidad del servicio."""
    return {"status": "ok"}