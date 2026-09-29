"""Esquemas Pydantic (request/response) para la API REST."""
import ipaddress
from datetime import datetime
from typing import Optional

from pydantic import (
    BaseModel, ConfigDict, Field, IPvAnyAddress, field_validator, model_validator,
)

from app.Models.ip_address import IPStatus
from app.Models.ip_state_history import CheckMethod

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

# --- Client -----------------------------------------------------------

class ClientRead(BaseModel):
    """Representación de salida de un Client (mapea el modelo ORM)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    document_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    wisphub_client_id: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

# --- Subnet ---------------------------------------------------------------

class SubnetRead(BaseModel):
    """Representación de salida de una Subnet (mapea el modelo ORM)."""
 
    model_config = ConfigDict(from_attributes=True)
 
    id: int
    cidr: str
    name: str
    description: Optional[str] = None
    vlan_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

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

# --- Subnet (escritura) ----------------------------------------------------

class SubnetCreate(BaseModel):
    cidr: str = Field(max_length=43)
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    vlan_id: Optional[int] = Field(default=None, ge=1, le=4094)

    @field_validator("cidr")
    @classmethod
    def _normalize_cidr(cls, v: str) -> str:
        v = v.strip()
        if "/" not in v:
            raise ValueError("El CIDR debe incluir el prefijo, ej. 192.168.1.0/24.")
        try:
            return str(ipaddress.ip_network(v, strict=False))
        except ValueError as exc:
            raise ValueError(f"CIDR inválido: {exc}") from exc


class SubnetUpdate(BaseModel):
    """El CIDR es inmutable (cambiarlo dejaría IPs fuera de su red)."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    vlan_id: Optional[int] = Field(default=None, ge=1, le=4094)


# --- Client (escritura) ----------------------------------------------------

class _ClientBase(BaseModel):
    document_id: Optional[str] = Field(default=None, max_length=30)
    email: Optional[str] = Field(default=None, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=30)
    address: Optional[str] = Field(default=None, max_length=255)
    wisphub_client_id: Optional[str] = Field(default=None, max_length=50)

    @field_validator("document_id")
    @classmethod
    def _blank_to_none(cls, v: Optional[str]) -> Optional[str]:
        # '' chocaría con la restricción UNIQUE de document_id.
        return v.strip() or None if v is not None else None


class ClientCreate(_ClientBase):
    full_name: str = Field(min_length=1, max_length=150)


class ClientUpdate(_ClientBase):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    is_active: Optional[bool] = None


# --- IPs (creación, historial, stats, consulta única) ---------------------

class IPCreateRequest(BaseModel):
    ip_address: IPvAnyAddress
    subnet_id: int
    client_id: Optional[int] = None
    description: Optional[str] = None


class IPStateHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ip_id: int
    previous_status: Optional[str] = None
    new_status: str
    method: CheckMethod
    details: Optional[str] = None
    checked_at: datetime


class SubnetStats(BaseModel):
    subnet_id: int
    cidr: str
    name: str
    total: int
    free: int
    assigned: int
    active: int


class IPStats(BaseModel):
    total: int
    free: int
    assigned: int
    active: int
    by_subnet: list[SubnetStats]


class IPQueryRequest(BaseModel):
    ip_address: IPvAnyAddress
    use_tcp: bool = False
    pin: Optional[str] = Field(default=None, repr=False)


class IPQueryResponse(BaseModel):
    ip_address: str
    ping: bool
    tcp: Optional[dict[int, bool]] = None
    evaluation: Optional[dict] = None
    note: Optional[str] = None


class SchedulerStatus(BaseModel):
    enabled: bool
    running: bool
    job_registered: bool
    interval_hours: int
    next_run_time: Optional[str] = None