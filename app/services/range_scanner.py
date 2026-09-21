"""
Módulo de escaneo por rango.

Cubre el segundo criterio de la Fase 2:
  - El usuario puede ingresar un rango explícito (ej. 192.168.1.1 -
    192.168.1.254) o una dirección + máscara de red, de la cual se deduce
    el rango de hosts.
  - A cada IP del rango se le lanza ÚNICAMENTE un PING (nunca TCP: los
    sockets TCP solo se disparan desde la consulta única y con PIN).
  - El PING se ejecuta de forma concurrente (con un límite configurable)
    para no tardar minutos en rangos grandes tipo /24.
"""
import asyncio
import ipaddress

from sqlalchemy.orm import Session

from app.Models.ip_state_history import CheckMethod
from app.crud import ip_address as ip_crud
from app.services.ping_service import ping_host

DEFAULT_CONCURRENCY = 30
DEFAULT_TIMEOUT = 2
# Límite de seguridad: evita que un usuario dispare por error un escaneo
# sobre un rango gigante (ej. una /8 completa) que tardaría horas.
MAX_HOSTS_PER_SCAN = 1024


# --- Construcción del listado de IPs -----------------------------------

def ips_from_range(start_ip: str, end_ip: str) -> list[str]:
    """Genera la lista de IPs entre start_ip y end_ip (ambas incluidas)."""
    start = ipaddress.ip_address(start_ip)
    end = ipaddress.ip_address(end_ip)

    if start.version != end.version:
        raise ValueError("La IP inicial y la final deben ser de la misma versión (IPv4/IPv6).")
    if int(end) < int(start):
        raise ValueError("La IP final debe ser mayor o igual a la IP inicial.")

    total = int(end) - int(start) + 1
    if total > MAX_HOSTS_PER_SCAN:
        raise ValueError(
            f"El rango tiene {total} IPs; supera el máximo permitido "
            f"por escaneo ({MAX_HOSTS_PER_SCAN})."
        )
    return [str(ipaddress.ip_address(i)) for i in range(int(start), int(end) + 1)]


def ips_from_network(address: str, netmask: str) -> list[str]:
    """Deduce el rango de hosts a partir de una IP + máscara de red.

    `netmask` acepta tanto la notación decimal (255.255.255.0) como el
    prefijo CIDR ("24").
    """
    network = ipaddress.ip_network(f"{address}/{netmask}", strict=False)
    hosts = list(network.hosts())

    if len(hosts) > MAX_HOSTS_PER_SCAN:
        raise ValueError(
            f"La red {network} tiene {len(hosts)} hosts; supera el máximo "
            f"permitido por escaneo ({MAX_HOSTS_PER_SCAN})."
        )
    return [str(ip) for ip in hosts]


def build_ip_list(start_ip: str | None = None, end_ip: str | None = None,
                   address: str | None = None, netmask: str | None = None) -> list[str]:
    """Punto único de entrada: recibe (start_ip, end_ip) O (address, netmask)."""
    if start_ip and end_ip:
        return ips_from_range(start_ip, end_ip)
    if address and netmask:
        return ips_from_network(address, netmask)
    raise ValueError(
        "Debe proporcionar un rango (start_ip y end_ip) o una red "
        "(address y netmask)."
    )


# --- Ping concurrente ----------------------------------------------------

async def _ping_with_semaphore(ip: str, semaphore: asyncio.Semaphore, timeout: int) -> dict:
    async with semaphore:
        # ping_host usa subprocess (bloqueante); to_thread evita congelar
        # el event loop mientras se ejecuta.
        is_up = await asyncio.to_thread(ping_host, ip, timeout)
        return {"ip_address": ip, "is_up": is_up}


async def scan_range_async(ips: list[str], concurrency: int = DEFAULT_CONCURRENCY,
                            timeout: int = DEFAULT_TIMEOUT) -> list[dict]:
    semaphore = asyncio.Semaphore(concurrency)
    tasks = [_ping_with_semaphore(ip, semaphore, timeout) for ip in ips]
    return await asyncio.gather(*tasks)


def scan_range(ips: list[str], concurrency: int = DEFAULT_CONCURRENCY,
               timeout: int = DEFAULT_TIMEOUT) -> list[dict]:
    """Wrapper síncrono para usar desde scripts/CLI."""
    return asyncio.run(scan_range_async(ips, concurrency, timeout))


# --- Orquestación: ping + registro en ip_state_history --------------------

def run_range_scan(db: Session, ips: list[str], concurrency: int = DEFAULT_CONCURRENCY,
                    timeout: int = DEFAULT_TIMEOUT) -> dict:
    """Ejecuta el ping sobre todas las IPs del rango y, para las que ya
    estén registradas en la base de datos, delega en el Módulo de
    Evaluación (app.services.evaluation.record_result) para actualizar su
    estado e insertar la fila correspondiente en ip_state_history.

    Las IPs del rango que NO existen en la base de datos se reportan en el
    resultado, pero no generan historial (no hay ip_id al cual asociarlo).
    """
    from app.services.evaluation import record_result  # import local, evita ciclos

    results = scan_range(ips, concurrency=concurrency, timeout=timeout)

    summary = {
        "total": len(results),
        "up": 0,
        "down": 0,
        "registered": 0,
        "unregistered": 0,
        "details": [],
    }

    for r in results:
        ip_address = r["ip_address"]
        is_up = r["is_up"]
        entry = {"ip_address": ip_address, "is_up": is_up, "evaluation": None}

        ip_obj = ip_crud.get_ip_by_address(db, ip_address)
        if ip_obj:
            entry["evaluation"] = record_result(
                db, ip_obj.id, is_up=is_up, method=CheckMethod.PING,
                details=f"range_scan ping={is_up}",
            )
            summary["registered"] += 1
        else:
            summary["unregistered"] += 1

        summary["up" if is_up else "down"] += 1
        summary["details"].append(entry)

    return summary