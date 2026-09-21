"""
Módulo de Consulta Única.

Representa la pestaña de "consulta directa a una IP específica":
  - Por defecto SOLO usa PING (ICMP). No requiere autorización.
  - Opcionalmente puede además usar Sockets TCP asíncronos, pero SOLO si el
    usuario aporta el PIN de autorización del proveedor. Si el PIN es
    inválido, no se dispara ningún socket TCP: se rechaza antes de escanear.

No hace descubrimiento de rango (eso corresponde al escaneo por rango, que
solo usará PING); esta es una verificación puntual sobre una única IP.
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

    Args:
        db: sesión de SQLAlchemy.
        ip_address: IP a consultar.
        use_tcp: si True, además del PING se intenta el escaneo TCP.
        provider_pin: PIN de autorización, obligatorio si use_tcp=True.

    Returns:
        dict con el resultado de ping, (opcional) tcp, y la evaluación
        registrada en ip_state_history si la IP existe en la base de datos.

    Raises:
        UnauthorizedTCPScanError: si use_tcp=True y el PIN es inválido.
    """
    from app.services.evaluation import record_result  # import local para evitar ciclos

    result: dict = {"ip_address": ip_address, "ping": None, "tcp": None}

    ping_ok = ping_host(ip_address)
    result["ping"] = ping_ok

    method = CheckMethod.PING
    is_up = ping_ok
    details = f"ping={ping_ok}"

    if use_tcp:
        # Si el PIN es inválido, esto lanza UnauthorizedTCPScanError y NO
        # se ejecuta ningún socket TCP.
        authorize_tcp_scan(provider_pin)

        tcp_results = scan_ports(ip_address)
        result["tcp"] = tcp_results
        method = CheckMethod.TCP
        is_up = ping_ok or any(tcp_results.values())
        details = f"ping={ping_ok}; tcp={tcp_results}"

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