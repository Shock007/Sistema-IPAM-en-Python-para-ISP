"""
Punto de entrada de la API REST (Fase 3).

Ejecutar en desarrollo:
    uvicorn app.main:app --reload

Documentación interactiva:
    http://127.0.0.1:8000/docs
"""
from fastapi import FastAPI

from app.api.routers.ips import router as ips_router

app = FastAPI(
    title="IPAM System API",
    description=(
        "API REST del sistema IPAM: gestión de direcciones IP, escaneo de "
        "red (PING) y asignación de titulares."
    ),
    version="0.3.0",
)

app.include_router(ips_router)


@app.get("/api/v1/health", tags=["health"])
def health_check() -> dict:
    """Chequeo simple de disponibilidad del servicio."""
    return {"status": "ok"}