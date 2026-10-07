from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.services.env_service import read_env_config, update_env_file

router = APIRouter(prefix="/api/v1/env", tags=["environment"])

class EnvSettingsRequest(BaseModel):
    database_url: Optional[str] = None
    provider_pin: Optional[str] = None
    scheduler_enabled: Optional[bool] = None
    scan_interval_hours: Optional[int] = None
    scan_concurrency: Optional[int] = None
    wisphub_api_key: Optional[str] = None
    wisphub_base_url: Optional[str] = None

class EnvSettingsResponse(BaseModel):
    status: str
    message: str
    db_configured: bool
    warning: Optional[str] = None
    current_config: dict

@router.get("", response_model=dict)
def get_environment_variables():
    """Obtiene la configuración actual almacenada en .env."""
    return read_env_config()

@router.put("", response_model=EnvSettingsResponse)
def update_environment_variables(payload: EnvSettingsRequest):
    """Actualiza las variables de entorno en .env comentando las vacías."""
    db_configured, warning = update_env_file(payload.model_dump())
    return EnvSettingsResponse(
        status="ok",
        message="Variables de entorno actualizadas correctamente.",
        db_configured=db_configured,
        warning=warning,
        current_config=read_env_config()
    )