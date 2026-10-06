"""
Router: /api/v1/ips

GET    /            listado + X-Total-Count
POST   /            crea una IP
GET    /stats       conteos por estado y subred
POST   /scan        escaneo (síncrono o en segundo plano)
POST   /query       consulta única (ping; TCP solo con PIN)
GET    /{ip}/history  historial de estados
PUT    /{ip}/assign asigna titular/estado/descripción
"""
import ipaddress
import logging
from typing import Optional, Union
from app.api.schemas import ScanCommitRequest, ScanCommitResponse  # añadir al import existente
from app.services.scan_commit import commit_scan

from fastapi import (
    APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, status,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_db, get_session_factory
from app.api.rate_limit import pin_limiter
from app.api.schemas import (
    IPAddressRead, IPAssignRequest, IPCreateRequest, IPQueryRequest, IPQueryResponse,
    IPStateHistoryRead, IPStats, ScanAcceptedResponse, ScanRangeRequest, ScanSummary,
    SubnetStats,
)
from app.crud import client as client_crud
from app.crud import ip_address as ip_crud
from app.crud import ip_state_history as history_crud
from app.crud import subnet as subnet_crud
from app.Models.ip_address import IPStatus
from app.services.authorization import MissingProviderPinError, UnauthorizedTCPScanError
from app.services.range_scanner import build_ip_list, run_range_scan, run_range_scan_background
from app.services.single_query import query_single_ip

logger = logging.getLogger("ipam.api")
router = APIRouter(prefix="/api/v1/ips", tags=["ips"])


def _normalize_ip(ip: str) -> str:
    try:
        return str(ipaddress.ip_address(ip))
    except ValueError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f"'{ip}' no es una dirección IP válida."
        ) from exc


def _get_ip_or_404(db: Session, ip: str):
    ip = _normalize_ip(ip)
    obj = ip_crud.get_ip_by_address(db, ip)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"La IP {ip} no está registrada en la base de datos.")
    return obj


# --- Listado / alta / stats ---------------------------------------------

@router.get("", response_model=list[IPAddressRead])
def list_ips(
    response: Response,
    status_filter: Optional[IPStatus] = Query(default=None, alias="status",
                                              description="FREE, ASSIGNED o ACTIVE."),
    subnet_id: Optional[int] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Listado paginado. El total (con los mismos filtros) va en X-Total-Count."""
    response.headers["X-Total-Count"] = str(
        ip_crud.count_ips(db, subnet_id=subnet_id, status=status_filter)
    )
    return ip_crud.list_ips(db, subnet_id=subnet_id, status=status_filter, skip=skip, limit=limit)


@router.post("", response_model=IPAddressRead, status_code=status.HTTP_201_CREATED)
def create_ip(payload: IPCreateRequest, db: Session = Depends(get_db)):
    """Crea una IP dentro de una subred. Con client_id queda ASSIGNED; sin él, FREE."""
    ip_str = str(payload.ip_address)

    subnet = subnet_crud.get_subnet(db, payload.subnet_id)
    if not subnet:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"La subred id={payload.subnet_id} no existe.")

    try:
        net = ipaddress.ip_network(subnet.cidr, strict=False)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            f"La subred tiene un CIDR inválido: {subnet.cidr}") from exc

    if payload.ip_address not in net:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            f"La IP {ip_str} no pertenece a la subred {subnet.cidr}.")
    if net.version == 4 and net.prefixlen < 31 and \
            payload.ip_address in (net.network_address, net.broadcast_address):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            f"{ip_str} es la dirección de red/broadcast de {subnet.cidr}.")

    if ip_crud.get_ip_by_address(db, ip_str):
        raise HTTPException(status.HTTP_409_CONFLICT, f"La IP {ip_str} ya está registrada.")

    if payload.client_id is not None and not client_crud.get_client(db, payload.client_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"El cliente con id={payload.client_id} no existe.")

    ip_status = IPStatus.ASSIGNED if payload.client_id is not None else IPStatus.FREE
    try:
        return ip_crud.create_ip(db, ip_address=ip_str, subnet_id=payload.subnet_id,
                                 client_id=payload.client_id, status=ip_status,
                                 description=payload.description)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"La IP {ip_str} ya está registrada.") from exc


@router.get("/stats", response_model=IPStats)
def ip_stats(subnet_id: Optional[int] = Query(default=None), db: Session = Depends(get_db)):
    """Conteos por estado, globales y por subred (incluye subredes sin IPs)."""
    subnets = subnet_crud.list_subnets(db, limit=100000)
    if subnet_id is not None:
        subnets = [s for s in subnets if s.id == subnet_id]

    by_id = {s.id: SubnetStats(subnet_id=s.id, cidr=s.cidr, name=s.name,
                               total=0, free=0, assigned=0, active=0) for s in subnets}
    for sid, st, n in ip_crud.count_by_subnet_and_status(db):
        row = by_id.get(sid)
        if row is None:
            continue
        row.total += n
        setattr(row, st.value.lower(), getattr(row, st.value.lower()) + n)

    rows = sorted(by_id.values(), key=lambda r: r.cidr)
    return IPStats(
        total=sum(r.total for r in rows), free=sum(r.free for r in rows),
        assigned=sum(r.assigned for r in rows), active=sum(r.active for r in rows),
        by_subnet=rows,
    )


# --- Escaneo --------------------------------------------------------------

@router.post("/scan", response_model=Union[ScanSummary, ScanAcceptedResponse],
             summary="Dispara el escaneo (ping) de un rango o red de IPs")
async def scan_ips(
    payload: ScanRangeRequest,
    background_tasks: BackgroundTasks,
    response: Response,
    db: Session = Depends(get_db),
    session_factory=Depends(get_session_factory),
):
    """`run_async=false`: espera y devuelve el resumen. `run_async=true`: 202 inmediato."""
    try:
        ips = build_ip_list(
            start_ip=str(payload.start_ip) if payload.start_ip else None,
            end_ip=str(payload.end_ip) if payload.end_ip else None,
            address=str(payload.address) if payload.address else None,
            netmask=payload.netmask,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if payload.run_async:
        # La tarea abre su PROPIA sesión: la `db` de la request puede estar
        # cerrada cuando la tarea se ejecute (depende de la versión de FastAPI).
        background_tasks.add_task(run_range_scan_background, session_factory, ips,
                                  payload.concurrency, payload.timeout)
        response.status_code = status.HTTP_202_ACCEPTED
        return ScanAcceptedResponse(message="Escaneo encolado en segundo plano.",
                                    total_ips=len(ips), concurrency=payload.concurrency,
                                    timeout=payload.timeout)

    return await run_in_threadpool(run_range_scan, db, ips, payload.concurrency,
                                   payload.timeout, not payload.dry_run)

@router.post("/scan/commit", response_model=ScanCommitResponse,
             summary="Guarda los resultados de un escaneo/consulta (vista previa confirmada)")
def commit_scan_results(payload: ScanCommitRequest, db: Session = Depends(get_db)):
    if payload.client_id is not None:
        if len(payload.results) != 1:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                                "client_id solo aplica a una consulta única.")
        if not client_crud.get_client(db, payload.client_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND,
                                f"El cliente con id={payload.client_id} no existe.")
    try:
        return commit_scan(db, payload)
    except IntegrityError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "Conflicto al guardar (duplicado).") from exc

# --- Consulta única -------------------------------------------------------

@router.post("/query", response_model=IPQueryResponse,
             summary="Consulta única: ping; TCP solo con PIN del proveedor")
def query_ip(payload: IPQueryRequest, request: Request, db: Session = Depends(get_db)):
    """Función síncrona a propósito: se ejecuta en threadpool, donde
    scan_ports puede usar asyncio.run sin chocar con el event loop."""
    key = request.client.host if request.client else "unknown"
    if payload.use_tcp:
        pin_limiter.check(key)
    try:
        result = query_single_ip(db, str(payload.ip_address), use_tcp=payload.use_tcp,
                                 provider_pin=payload.pin, persist=not payload.dry_run)
    except UnauthorizedTCPScanError as exc:
        pin_limiter.register_failure(key)
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except MissingProviderPinError as exc:
        logger.error("PROVIDER_PIN no configurado: %s", exc)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                            "Consulta TCP no disponible: configuración del servidor incompleta.") from exc
    if payload.use_tcp:
        pin_limiter.reset(key)
    return result


# --- Por IP ----------------------------------------------------------------

@router.get("/{ip}/history", response_model=list[IPStateHistoryRead])
def ip_history(ip: str, limit: int = Query(default=50, ge=1, le=500),
               db: Session = Depends(get_db)):
    ip_obj = _get_ip_or_404(db, ip)
    return history_crud.list_history(db, ip_obj.id, limit=limit)


@router.put("/{ip}/assign", response_model=IPAddressRead)
def assign_ip(ip: str, payload: IPAssignRequest, db: Session = Depends(get_db)):
    """Asigna (o desasigna, con client_id=null) un titular a una IP existente."""
    ip_obj = _get_ip_or_404(db, ip)

    if payload.client_id is not None and not client_crud.get_client(db, payload.client_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND,
                            f"El cliente con id={payload.client_id} no existe.")

    return ip_crud.assign_ip(db, ip_obj.id, client_id=payload.client_id,
                             description=payload.description, status=payload.status)