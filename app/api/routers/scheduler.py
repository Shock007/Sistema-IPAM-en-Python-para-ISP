"""Router: /api/v1/scheduler (estado del job y disparo manual)."""
from fastapi import APIRouter, BackgroundTasks, HTTPException, status

from app.api.schemas import SchedulerStatus
from app.config import SCAN_INTERVAL_HOURS, SCHEDULER_ENABLED
from app.services.scheduler import JOB_ID, run_scheduled_audit, scheduler
from app.api.deps import NO_DB_MSG
from app.database import SessionLocal

router = APIRouter(prefix="/api/v1/scheduler", tags=["scheduler"])


@router.get("/status", response_model=SchedulerStatus)
def scheduler_status():
    job = scheduler.get_job(JOB_ID)
    next_run = getattr(job, "next_run_time", None) if job else None
    return SchedulerStatus(
        enabled=SCHEDULER_ENABLED,
        running=scheduler.running,
        job_registered=job is not None,
        interval_hours=SCAN_INTERVAL_HOURS,
        next_run_time=next_run.isoformat() if next_run else None,
    )



@router.post("/run-now")
def trigger_audit_now(background_tasks: BackgroundTasks):
    if SessionLocal is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_DB_MSG)
    background_tasks.add_task(run_scheduled_audit)
    return {"message": "Auditoría disparada en segundo plano."}