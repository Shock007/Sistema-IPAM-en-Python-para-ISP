"""
Router: /api/v1/ips

- GET    /api/v1/ips             -> listado con filtros de estado y subred
- POST   /api/v1/ips/scan        -> dispara un escaneo (síncrono o en segundo plano)
- PUT    /api/v1/ips/{ip}/assign -> asigna titular/estado/descripción a una IP
"""
import ipaddress
from typing import Optional, Union

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_db
from app.api.schemas import (
    IPAddressRead,
    IPAssignRequest,
    ScanAcceptedResponse,
    ScanRangeRequest,
    ScanSummary,
)
from app.crud import client as client_crud
from app.crud import ip_address as ip_crud
from app.Models.ip_address import IPStatus
from app.services.range_scanner import build_ip_list, run_range_scan

router = APIRouter(prefix="/api/v1/ips", tags=["ips"])


@router.get("", response_model=list[IPAddressRead])
def list_ips(
    status_filter: Optional[IPStatus] = Query(
        default=None,
        alias="status",
        description="Filtra por estado: FREE, ASSIGNED o ACTIVE.",
    ),
    subnet_id: Optional[int] = Query(default=None, description="Filtra por subred."),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Listado de IPs con filtros opcionales por estado y subred, con paginación."""
    return ip_crud.list_ips(
        db, subnet_id=subnet_id, status=status_filter, skip=skip, limit=limit
    )


@router.post(
    "/scan",
    response_model=Union[ScanSummary, ScanAcceptedResponse],
    summary="Dispara el escaneo (ping) de un rango o red de IPs",
)
async def scan_ips(
    payload: ScanRangeRequest,
    background_tasks: BackgroundTasks,
    response: Response,
    db: Session = Depends(get_db),
):
    """Construye la lista de IPs (rango o red+máscara) y ejecuta el escaneo
    del Módulo NetworkScanner (solo PING; ver app/services/range_scanner.py).

    - `run_async=false` (por defecto): espera el resultado y lo devuelve completo.
    - `run_async=true`: encola el escaneo en segundo plano y responde 202 de inmediato.
    """
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
        # run_range_scan es una función síncrona; Starlette la ejecuta en un
        # hilo de threadpool, por lo que no bloquea el event loop principal.
        background_tasks.add_task(
            run_range_scan, db, ips, payload.concurrency, payload.timeout
        )
        response.status_code = status.HTTP_202_ACCEPTED
        return ScanAcceptedResponse(
            message="Escaneo encolado en segundo plano.",
            total_ips=len(ips),
            concurrency=payload.concurrency,
            timeout=payload.timeout,
        )

    # Modo síncrono: se ejecuta en threadpool para no bloquear el event loop
    # mientras se espera el resultado completo.
    summary = await run_in_threadpool(
        run_range_scan, db, ips, payload.concurrency, payload.timeout
    )
    return summary


@router.put("/{ip}/assign", response_model=IPAddressRead)
def assign_ip(ip: str, payload: IPAssignRequest, db: Session = Depends(get_db)):
    """Asigna (o desasigna, con client_id=null) un titular a una IP existente,
    junto con su descripción y estado."""
    try:
        ipaddress.ip_address(ip)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"'{ip}' no es una dirección IP válida.",
        ) from exc

    ip_obj = ip_crud.get_ip_by_address(db, ip)
    if not ip_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"La IP {ip} no está registrada en la base de datos.",
        )

    if payload.client_id is not None:
        cliente = client_crud.get_client(db, payload.client_id)
        if not cliente:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El cliente con id={payload.client_id} no existe.",
            )

    updated = ip_crud.assign_ip(
        db,
        ip_obj.id,
        client_id=payload.client_id,
        description=payload.description,
        status=payload.status,
    )
    return updated