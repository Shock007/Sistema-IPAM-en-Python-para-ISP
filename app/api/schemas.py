"""
Esquemas Pydantic (request/response) para la API REST de la Fase 3.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.Models.ip_address import IPStatus


# --- IPAddress ---------------------------------------------------------

class IPAddressRead(BaseModel):
    """Representación de salida de una IPAddress (mapea el modelo ORM)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    ip_address: str
    subnet_id: int
    client_id: Optional[int] = None
    status: IPStatus
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class IPAssignRequest(BaseModel):
    """Body de PUT /api/v1/ips/{ip}/assign."""

    client_id: Optional[int] = Field(
        default=None,
        description="ID del cliente titular. Enviar null para desasignar.",
    )
    description: Optional[str] = None
    status: IPStatus = Field(
        default=IPStatus.ASSIGNED,
        description="Estado a fijar. Por defecto ASSIGNED al asignar un titular.",
    )


# --- Scan ----------------------------------------------------------------

class ScanRangeRequest(BaseModel):
    """Body de POST /api/v1/ips/scan.

    Acepta un rango explícito (start_ip/end_ip) O una red (address/netmask).
    """

    start_ip: Optional[str] = None
    end_ip: Optional[str] = None
    address: Optional[str] = None
    netmask: Optional[str] = None

    concurrency: int = Field(default=30, ge=1, le=200)
    timeout: int = Field(default=2, ge=1, le=30)
    run_async: bool = Field(
        default=False,
        description="Si es true, el escaneo corre en segundo plano y la "
        "respuesta es inmediata (202 Accepted). Si es false, la petición "
        "espera a que el escaneo termine y devuelve el resumen completo.",
    )

    @model_validator(mode="after")
    def _check_range_or_network(self) -> "ScanRangeRequest":
        has_range = bool(self.start_ip and self.end_ip)
        has_network = bool(self.address and self.netmask)
        if not has_range and not has_network:
            raise ValueError(
                "Debe proporcionar un rango (start_ip y end_ip) o una red "
                "(address y netmask)."
            )
        return self


class ScanDetail(BaseModel):
    ip_address: str
    is_up: bool
    evaluation: Optional[dict] = None


class ScanSummary(BaseModel):
    """Respuesta de un escaneo síncrono (run_async=false)."""

    total: int
    up: int
    down: int
    registered: int
    unregistered: int
    details: list[ScanDetail]


class ScanAcceptedResponse(BaseModel):
    """Respuesta de un escaneo asíncrono (run_async=true)."""

    message: str
    total_ips: int
    concurrency: int
    timeout: int