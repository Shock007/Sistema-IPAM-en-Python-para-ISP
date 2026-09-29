"""
Punto de entrada de la API REST + Dashboard estático.

    uvicorn app.main:app --reload
Docs: http://127.0.0.1:8000/docs   |   Dashboard: http://127.0.0.1:8000/dashboard/
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routers.clients import router as clients_router
from app.api.routers.ips import router as ips_router
from app.api.routers.scheduler import router as scheduler_router
from app.api.routers.subnets import router as subnets_router
from app.config import SCHEDULER_ENABLED
from app.services.scheduler import shutdown_scheduler, start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Con varios workers de uvicorn cada uno arrancaría su scheduler:
    # usar un solo worker o SCHEDULER_ENABLED=true en uno solo.
    if SCHEDULER_ENABLED:
        start_scheduler()
    try:
        yield
    finally:
        shutdown_scheduler()


app = FastAPI(
    title="IPAM System API",
    description="API REST del sistema IPAM: IPs, subredes, clientes, escaneo (PING) y auditoría automática.",
    version="0.5.0",
    lifespan=lifespan,
)

# En producción restringir allow_origins a la URL real del frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],  # sin esto el navegador no puede leerlo
)

app.include_router(ips_router)
app.include_router(subnets_router)
app.include_router(clients_router)
app.include_router(scheduler_router)

app.mount("/dashboard", StaticFiles(directory="static/dashboard", html=True), name="dashboard")


@app.get("/api/v1/health", tags=["health"])
def health_check() -> dict:
    return {"status": "ok"}