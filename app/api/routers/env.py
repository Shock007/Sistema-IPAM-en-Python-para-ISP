import re
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services.env_service import public_config, update_env_file

from fastapi import APIRouter, Depends, HTTPException, status
from app.api.security import require_admin

router = APIRouter(prefix="/api/v1/env", tags=["environment"],
                   dependencies=[Depends(require_admin)])

router = APIRouter(prefix="/api/v1/env", tags=["environment"])

_UNSAFE = re.compile(r"[\s#\"'\\]")
_DB_URL = re.compile(r"^(postgresql|mysql)(\+\w+)?://\S+$")


class EnvSettingsRequest(BaseModel):
    """Campo ausente/null = conservar; "" = quitar; valor = reemplazar."""
    model_config = ConfigDict(extra="forbid")

    database_url: Optional[str] = Field(default=None, max_length=500)
    provider_pin: Optional[str] = Field(default=None, max_length=64)
    wisphub_api_key: Optional[str] = Field(default=None, max_length=255)
    wisphub_base_url: Optional[str] = Field(default=None, max_length=255)
    scheduler_enabled: Optional[bool] = None
    scan_interval_hours: Optional[int] = Field(default=None, ge=1, le=168)
    scan_concurrency: Optional[int] = Field(default=None, ge=1, le=200)
    scan_timeout: Optional[int] = Field(default=None, ge=1, le=30)

    @field_validator("database_url", "provider_pin", "wisphub_api_key", "wisphub_base_url")
    @classmethod
    def _no_unsafe_chars(cls, v):
        if v and _UNSAFE.search(v):
            raise ValueError("No puede contener espacios, comillas, '#', '\\' ni saltos de línea.")
        return v

    @field_validator("database_url")
    @classmethod
    def _db_format(cls, v):
        if v and not _DB_URL.match(v):
            raise ValueError("Debe iniciar con postgresql:// o mysql:// "
                             "(p. ej. postgresql+psycopg2://, mysql+pymysql://).")
        return v

    @field_validator("wisphub_base_url")
    @classmethod
    def _http_url(cls, v):
        if v and not re.match(r"^https?://\S+$", v):
            raise ValueError("Debe iniciar con http:// o https://.")
        return v


class EnvSettingsResponse(BaseModel):
    status: str
    message: str
    db_configured: bool
    restart_required: bool
    warning: Optional[str] = None
    current_config: dict


@router.get("", response_model=dict)
def get_environment_variables():
    """Configuración actual SIN secretos (solo *_set y vistas enmascaradas)."""
    return public_config()


@router.put("", response_model=EnvSettingsResponse)
def update_environment_variables(payload: EnvSettingsRequest):
    try:
        db_configured, warning, restart_required = update_env_file(
            payload.model_dump(exclude_unset=True)
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    message = "Variables de entorno actualizadas correctamente."
    if restart_required:
        message += " Reinicia el servidor para aplicar los cambios."
    return EnvSettingsResponse(
        status="ok", message=message, db_configured=db_configured,
        restart_required=restart_required, warning=warning,
        current_config=public_config(),
    )