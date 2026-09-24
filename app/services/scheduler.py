"""
Módulo de Automatización (Fase 3).

Programa una auditoría periódica de red: recorre todas las subredes
registradas en la base de datos y ejecuta sobre cada una un escaneo por
rango (solo PING, ver app/services/range_scanner.py), delegando en
run_range_scan la actualización de ip_addresses.status e
ip_state_history a través del Módulo de Evaluación.

Se usa BackgroundScheduler (APScheduler síncrono) porque corre en un
hilo propio y no requiere integrarse con el event loop de asyncio de
FastAPI/uvicorn.
"""
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import SCAN_CONCURRENCY, SCAN_INTERVAL_HOURS, SCAN_TIMEOUT
from app.crud import subnet as subnet_crud
from app.database import SessionLocal
from app.services.range_scanner import ips_from_network, run_range_scan

logger = logging.getLogger("ipam.scheduler")

JOB_ID = "network_audit"

scheduler = BackgroundScheduler(timezone="UTC")


def run_scheduled_audit() -> dict:
    """Ejecuta un ciclo completo de auditoría sobre todas las subredes.

    Abre y cierra su propia sesión de BD porque corre en el hilo del
    scheduler, fuera del ciclo de vida de una request HTTP normal.
    """
    db = SessionLocal()
    resumen = {
        "subredes_escaneadas": 0,
        "subredes_omitidas": 0,
        "total_ips": 0,
        "up": 0,
        "down": 0,
        "errores": [],
    }
    try:
        subredes = subnet_crud.list_subnets(db, limit=1000)

        for red in subredes:
            try:
                if "/" not in red.cidr:
                    resumen["subredes_omitidas"] += 1
                    continue

                address, netmask = red.cidr.split("/", 1)
                ips = ips_from_network(address, netmask)
                if not ips:
                    resumen["subredes_omitidas"] += 1
                    continue

                summary = run_range_scan(
                    db, ips, concurrency=SCAN_CONCURRENCY, timeout=SCAN_TIMEOUT
                )
                resumen["subredes_escaneadas"] += 1
                resumen["total_ips"] += summary["total"]
                resumen["up"] += summary["up"]
                resumen["down"] += summary["down"]

            except ValueError as exc:
                # ej. red demasiado grande (> MAX_HOSTS_PER_SCAN)
                logger.warning("Subred %s omitida: %s", red.cidr, exc)
                resumen["subredes_omitidas"] += 1
                resumen["errores"].append({"subnet": red.cidr, "error": str(exc)})
            except Exception as exc:  # noqa: BLE001
                logger.exception("Error auditando subred %s", red.cidr)
                resumen["errores"].append({"subnet": red.cidr, "error": str(exc)})

        logger.info(
            "Auditoría automática completada: %s subredes escaneadas, "
            "%s IPs (%s up / %s down), %s omitidas.",
            resumen["subredes_escaneadas"], resumen["total_ips"],
            resumen["up"], resumen["down"], resumen["subredes_omitidas"],
        )
    finally:
        db.close()

    return resumen


def start_scheduler() -> None:
    """Registra el job periódico e inicia el scheduler. Idempotente."""
    if scheduler.running:
        return

    scheduler.add_job(
        run_scheduled_audit,
        trigger=IntervalTrigger(hours=SCAN_INTERVAL_HOURS),
        id=JOB_ID,
        name=f"Auditoría automática de red cada {SCAN_INTERVAL_HOURS}h",
        replace_existing=True,
        max_instances=1,  # evita solapar corridas si una tarda más que el intervalo
        coalesce=True,    # si se pierden ejecuciones (server caído), solo corre una al volver
    )
    scheduler.start()
    logger.info("Scheduler iniciado: auditoría cada %s horas.", SCAN_INTERVAL_HOURS)


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler detenido.")