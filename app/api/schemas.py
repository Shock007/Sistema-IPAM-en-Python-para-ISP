"""
Esquemas Pydantic (request/response) para la API REST de la Fase 3.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, IPvAnyAddress, model_validator

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

    @model_validator(mode="after")
    def _check_status_client_consistency(self) -> "IPAssignRequest":
        """Reglas de negocio (ver app/services/evaluation.py):

        - ACTIVE lo determina el motor de evaluación (ping/tcp); no se
          asigna manualmente desde este endpoint.
        - ASSIGNED es un vínculo administrativo: requiere un client_id.
        - FREE significa sin titular: no debe llevar client_id.
        """
        if self.status == IPStatus.ACTIVE:
            raise ValueError(
                "El estado ACTIVE lo determina el motor de evaluación "
                "(ping/tcp) y no puede asignarse manualmente aquí."
            )
        if self.status == IPStatus.ASSIGNED and self.client_id is None:
            raise ValueError("El estado ASSIGNED requiere indicar 'client_id'.")
        if self.status == IPStatus.FREE and self.client_id is not None:
            raise ValueError("Una IP en estado FREE no puede tener 'client_id'.")
        return self


# --- Scan ----------------------------------------------------------------

class ScanRangeRequest(BaseModel):
    """Body de POST /api/v1/ips/scan.

    Acepta un rango explícito (start_ip/end_ip) O una red (address/netmask).
    """

    start_ip: Optional[IPvAnyAddress] = None
    end_ip: Optional[IPvAnyAddress] = None
    address: Optional[IPvAnyAddress] = None
    netmask: Optional[str] = Field(
        default=None,
        description="Prefijo CIDR ('24') o máscara decimal ('255.255.255.0').",
    )

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