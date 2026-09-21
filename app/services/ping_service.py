"""
Verificación de disponibilidad vía ICMP Ping.

Usa el binario 'ping' del sistema operativo (no un socket ICMP raw), por lo
que NO requiere privilegios de administrador/root y funciona igual en
Windows, Linux y macOS.
"""
import platform
import subprocess


def ping_host(ip: str, timeout: int = 2) -> bool:
    """Devuelve True si el host responde al ping, False en caso contrario
    (host caído, IP inválida, timeout, o el binario 'ping' no existe)."""
    system = platform.system().lower()

    if system == "windows":
        cmd = ["ping", "-n", "1", "-w", str(timeout * 1000), ip]
    else:
        cmd = ["ping", "-c", "1", "-W", str(timeout), ip]

    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=timeout + 2,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return False