"""
Módulo NetworkScanner (sin Nmap): verificación vía Sockets TCP asíncronos.

IMPORTANTE: este módulo NUNCA se ejecuta de forma autónoma ni en el escaneo
por rango. Solo se invoca desde la consulta única, y únicamente si el
usuario aporta el PIN de autorización del proveedor
(ver app/services/authorization.py).
"""
import asyncio

# Puertos estratégicos de ISP (routers, CPEs, mikrotik, servicios comunes).
DEFAULT_PORTS: list[int] = [80, 443, 8291, 22, 53, 8080, 23]


async def _check_port(ip: str, port: int, timeout: float) -> bool:
    writer = None
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(ip, port), timeout=timeout
        )
        return True
    except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
        return False
    finally:
        if writer is not None:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass


async def scan_ports_async(ip: str, ports: list[int] | None = None,
                            timeout: float = 1.5) -> dict[int, bool]:
    ports = ports or DEFAULT_PORTS
    tasks = {port: _check_port(ip, port, timeout) for port in ports}
    results = await asyncio.gather(*tasks.values())
    return dict(zip(tasks.keys(), results))


def scan_ports(ip: str, ports: list[int] | None = None,
               timeout: float = 1.5) -> dict[int, bool]:
    """Wrapper síncrono, útil para llamarlo desde scripts/CLI o desde una
    vista síncrona sin tener que manejar el event loop manualmente."""
    return asyncio.run(scan_ports_async(ip, ports, timeout))