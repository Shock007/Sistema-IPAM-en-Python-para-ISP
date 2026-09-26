"""
Punto de entrada de la API REST (Fase 3) + Dashboard estático (Fase 4).

Ejecutar en desarrollo:
    uvicorn app.main:app --reload

Documentación interactiva:
    http://127.0.0.1:8000/docs

Dashboard:
    http://127.0.0.1:8000/dashboard/
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routers.ips import router as ips_router
from app.api.routers.subnets import router as subnets_router

app = FastAPI(
    title="IPAM System API",
    description=(
        "API REST del sistema IPAM: gestión de direcciones IP, escaneo de "
        "red (PING) y asignación de titulares."
    ),
    version="0.4.0",
)

# CORS: permite que el dashboard consuma la API aunque en el futuro (Fase 4.2,
# Docker) quede en un origen/puerto distinto. En desarrollo se deja abierto;
# restringir 'allow_origins' en producción a la URL real del dashboard.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ips_router)
app.include_router(subnets_router)

# Dashboard estático: sirve static/dashboard/index.html en /dashboard/
app.mount(
    "/dashboard",
    StaticFiles(directory="static/dashboard", html=True),
    name="dashboard",
)


@app.get("/api/v1/health", tags=["health"])
def health_check() -> dict:
    """Chequeo simple de disponibilidad del servicio."""
    return {"status": "ok"}