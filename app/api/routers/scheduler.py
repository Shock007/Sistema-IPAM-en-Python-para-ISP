"""
Router: /api/v1/scheduler

Expone el estado del job de auditoría automática y permite dispararlo
manualmente (útil para pruebas, sin esperar al intervalo programado).
"""
from fastapi import APIRouter, BackgroundTasks

from app.services.scheduler import JOB_ID, run_scheduled_audit, scheduler

router = APIRouter(prefix="/api/v1/scheduler", tags=["scheduler"])


@router.get("/status")
def scheduler_status():
    job = scheduler.get_job(JOB_ID)
    return {
        "running": scheduler.running,
        "job_registered": job is not None,
        "next_run_time": job.next_run_time.isoformat() if job and job.next_run_time else None,
    }


@router.post("/run-now")
def trigger_audit_now(background_tasks: BackgroundTasks):
    """Ejecuta la auditoría inmediatamente en segundo plano, sin alterar
    la programación periódica existente."""
    background_tasks.add_task(run_scheduled_audit)
    return {"message": "Auditoría disparada en segundo plano."}