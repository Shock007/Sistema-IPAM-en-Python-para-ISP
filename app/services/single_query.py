"""
Módulo de Consulta Única.

  - Por defecto SOLO usa PING (ICMP). No requiere autorización.
  - Opcionalmente además Sockets TCP asíncronos, pero SOLO con el PIN del
    proveedor. Si el PIN es inválido se rechaza ANTES de cualquier acción
    de red (ni ping ni TCP).
"""
from sqlalchemy.orm import Session

from app.Models.ip_state_history import CheckMethod
from app.crud import ip_address as ip_crud
from app.services.ping_service import ping_host
from app.services.tcp_scanner import scan_ports
from app.services.authorization import authorize_tcp_scan, UnauthorizedTCPScanError

__all__ = ["query_single_ip", "UnauthorizedTCPScanError"]


def query_single_ip(db: Session, ip_address: str, use_tcp: bool = False,
                     provider_pin: str | None = None) -> dict:
    """Ejecuta la consulta única sobre una IP.

    Raises:
        UnauthorizedTCPScanError: use_tcp=True y PIN inválido.
        MissingProviderPinError: use_tcp=True y PROVIDER_PIN sin configurar.
    """
    from app.services.evaluation import record_result  # import local para evitar ciclos

    # 1) Autorización primero: si falla, no se ejecuta ninguna acción de red.
    if use_tcp:
        authorize_tcp_scan(provider_pin)

    result: dict = {"ip_address": ip_address, "ping": None, "tcp": None}

    # 2) Ping (siempre).
    ping_ok = ping_host(ip_address)
    result["ping"] = ping_ok

    method = CheckMethod.PING
    is_up = ping_ok
    details = f"ping={ping_ok}"

    # 3) TCP (solo si ya se autorizó).
    if use_tcp:
        tcp_results = scan_ports(ip_address)
        result["tcp"] = tcp_results
        method = CheckMethod.TCP
        is_up = ping_ok or any(tcp_results.values())
        details = f"ping={ping_ok}; tcp={tcp_results}"

    # 4) Evaluación / historial si la IP está registrada.
    ip_obj = ip_crud.get_ip_by_address(db, ip_address)
    if ip_obj:
        result["evaluation"] = record_result(
            db, ip_obj.id, is_up=is_up, method=method, details=details,
        )
    else:
        result["evaluation"] = None
        result["note"] = (
            "La IP no está registrada en la base de datos; se consultó "
            "pero no se guardó historial."
        )

    return result