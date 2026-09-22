"""
Autorización para las consultas vía Sockets TCP asíncronos.

El método definitivo de autorización del proveedor aún no ha sido definido
por el usuario. Mientras tanto, el acceso al NetworkScanner (TCP) se
restringe mediante un PIN leído de variable de entorno (PROVIDER_PIN).
Este mecanismo debe reemplazarse el día que el proveedor defina el flujo
real (ej. token firmado, API key, OAuth, lista blanca de IPs autorizadas, etc.).
"""
from app.config import PROVIDER_PIN


class UnauthorizedTCPScanError(Exception):
    """Se lanza cuando se intenta un escaneo TCP sin el PIN correcto."""


class MissingProviderPinError(Exception):
    """Se lanza si PROVIDER_PIN no está configurado en el entorno (.env)."""


def authorize_tcp_scan(pin: str | None) -> bool:
    """Valida el PIN de autorización para consultas TCP.

    Lanza MissingProviderPinError si el servidor no tiene PROVIDER_PIN
    configurado (fallo de despliegue, no del usuario).
    Lanza UnauthorizedTCPScanError si el PIN entregado es inválido o
    ausente, de modo que la capa que llama (CLI/API) pueda capturarla y
    devolver un mensaje claro al usuario sin haber disparado ningún
    socket todavía.
    """
    if not PROVIDER_PIN:
        raise MissingProviderPinError(
            "PROVIDER_PIN no está configurado en el entorno (.env). "
            "Defina la variable antes de habilitar consultas TCP."
        )
    if pin != PROVIDER_PIN:
        raise UnauthorizedTCPScanError(
            "PIN de autorización inválido. Las consultas vía Sockets TCP "
            "requieren autorización explícita del proveedor."
        )
    return True